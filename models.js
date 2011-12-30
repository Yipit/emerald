var _ = require('underscore')._;
var models = require('clay');
var crypto = require('crypto');
var mkdirp = require('mkdirp');
var async = require('async');
var path = require('path');
var fs = require('fs');
var child_process = require('child_process');
var settings = require('./settings');
var logger = new (require('./logger').Logger)("[models]".cyan.bold);

var STAGES_BY_INDEX = {
    0: 'BEGINNING',
    1: 'FETCHING',
    2: 'PREPARING_ENVIRONMENT',
    3: 'RUNNING',
    4: 'FINISHED'
}
var STAGES_BY_NAME = {
    BEGINNING: 0,
    FETCHING: 1,
    PREPARING_ENVIRONMENT: 2,
    RUNNING: 3,
    FINISHED: 4
}

var User = models.declare("User", function(it, kind){
    it.has.field("name", kind.string);
    it.has.field("email", kind.email);
    it.has.field("created_at", kind.auto);
    it.has.field("password", kind.string);

    it.validates.uniquenessOf("name");
    it.validates.uniquenessOf("email");

    it.has.getter('permalink', function(){
        return '/user/' + this.__id__;
    });
    it.has.method('gravatar_of_size', function(size){
        var hash = crypto.createHash('md5');
        hash.update(this.email || '');
        return 'http://www.gravatar.com/avatar/' + hash.digest('hex') + '?s=' + size;
    });

    it.has.method('authenticate', function(attempt, callback){
        if (attempt === this.password) {
            return callback(null, this);
        } else {
            return callback(new Error('wrong password for the login "' + this.email + '"'), null);
        }
    });

    it.has.class_method('authenticate', function(login, password, callback){
        if (!login) {
            return callback(new Error("Invalid email: " + login))
        }
        this.find_by_email(new RegExp(login), function(err, items){
            var found = items.first;
            if (err) {
                return callback(new Error('there are no users matching the email "' + login + '"'));
            }
            return found.authenticate(password, callback);
        });

    });

});

var Build = models.declare("Build", function(it, kind) {
    it.has.field("status", kind.string);
    it.has.field("signal", kind.string);
    it.has.field("error", kind.string);
    it.has.field("output", kind.string);
    it.has.field("pid", kind.numeric);
    it.has.field("stage", kind.numeric);
    it.has.field("commit", kind.string);
    it.has.field("author_name", kind.string);
    it.has.field("author_email", kind.string);
    it.has.field("build_started_at", kind.auto);
    it.has.field("build_finished_at", kind.datetime);
    it.has.field("fetching_started_at", kind.auto);
    it.has.field("fetching_finished_at", kind.datetime);

    it.has.getter('started_at', function() {
        return this.build_started_at || this.fetching_started_at;
    });

    it.has.getter('finished_at', function() {
        return this.build_finished_at || this.fetching_finished_at;
    });

    it.has.getter('permalink', function() {
        return '/build/' + this.__id__;
    });
    it.has.getter('non_circular_data', function() {
        var self = this;
        var data = _.clone(self.__data__);
        delete data.instruction;
        return data;
    });
});

var BuildInstruction = models.declare("BuildInstruction", function(it, kind) {
    it.has.field("name", kind.string);
    it.has.field("description", kind.string);
    it.has.field("repository_address", kind.string);
    it.has.field("branch", kind.string);
    it.has.field("build_script", kind.string);
    it.has.one("author", User, "created_instructions");

    it.validates.uniquenessOf("name");

    it.has.index("repository_address");
    it.has.many("builds", Build, "instruction");

    it.has.getter('permalink', function() {
        return '/instruction/' + this.__id__;
    });
    it.has.getter('total_builds', function() {
        return this.builds.length;
    });
    it.has.getter('non_circular_data', function() {
        var self = this;
        var data = _.clone(this.__data__);
        var clean_builds = _.filter(_.map(data.builds, function fetch_non_circular_data_from_each_build (_build){
            var build = _build && _build.non_circular_data && _.clone(_build.non_circular_data) || null;
            return build;
        }), function filter_by_non_null_items(build){
            return !_.isNull(build) && !_.isUndefined(build);
        });
        delete data.builds;
        data.builds = clean_builds;
        return data;
    });

    it.has.method('get_builds', function(callback) {
        var self = this;
        var now = new Date();
        var redis = self._meta.storage.connection;
        if (_.isArray(self._builds) && (self._builds.length > 0)) {
            /*                      && ((now - self._builds_cache_timestamp) < settings.DB_CACHE_TIMEOUT)) {*/
            return self._builds;
        }

        redis.zrange("clay:BuildInstruction:id:" + self.__id__ + ":builds", 0, -1, function(err, builds){
            async.map(builds, function(build_key, callback){
                Build.find_by_id(build_key, function(err, key, build){
                    self._builds_cache_timestamp = now;
                    return callback(err, build);
                });
            }, callback);
        });
    });
    it.has.method('get_latest_build', function(callback) {
        var self = this;
        var now = new Date();
        if (_.isObject(self._latest_build) && _.isNumber(self._latest_build.__id__)){
                                        /* && ((now - self._latest_build_cache_timestamp) > settings.DB_CACHE_TIMEOUT){*/
            return self._latest_build;
        }
        self.get_builds(function(err, builds){
            var first_build = builds.pop(0);
            async.reduce(builds, first_build, function(memo, item, callback){
                self._latest_build_cache_timestamp = now;
                callback((memo.finished_at > item.finished_at) ? memo : item);
            }, callback);
        });
    });

    it.has.method('run', function(current_build, lock) {
        var self = this;

        current_build.started_at = new Date();
        var hash = crypto.createHash('md5');
        hash.update((new Date()).toString() + self.name);
        function filter_output (text) {
            return text.replace(/\x1B\[([0-9]{1,2}(;[0-9]{1,2})?)?[m|K]/g, '');
        }

        var redis = self._meta.storage.connection;
        /* TODO: extract the repo name and check if already exists e*/
        var repository_folder_name = (self.repository_address + self.name)
            .replace(/\W+/g, '-')
            .toLowerCase()
            .replace(/[-]?\bgit\b[-]?/g, '');
        var repository_full_path = path.join(settings.SANDBOX_PATH, repository_folder_name);
        var repository_bare_path = path.join(repository_full_path, '.git');

        var script_name = hash.digest('hex') + '.sh';
        var script_path = path.join(repository_full_path, script_name);

        var branch_to_build = self.branch || "master";
        redis.publish("Build started", JSON.stringify({
            build: current_build.non_circular_data,
            instruction: self.non_circular_data
        }));
        async.waterfall([
            function sync_the_builds(callback){
                self._meta.storage.sync(self, function(err, self){
                    callback(err, self);
                });
            },
            function decide_whether_pull_or_clone (self, callback){
                logger.info('preparing to fetch data from "'+self.name+'" through "'+self.repository_address+'@'+branch_to_build+'" at ' + repository_full_path);
                path.exists(repository_bare_path, function(exists){callback(null, self, exists)})
            },
            function assemble_the_command_line (self, exists, callback) {
                var args, options = {};
                if (exists) {
                    args = ["pull", "origin", branch_to_build || "master"];
                    options.cwd = repository_full_path;
                    logger.info('found an existing git repo at "'+repository_bare_path+'", gonna use git-pull');
                } else {
                    args = ["clone", self.repository_address, repository_folder_name];
                    logger.info('local copy does not exist, will clone at "'+repository_full_path+'"');
                    options.cwd = settings.SANDBOX_PATH;
                }
                callback(null, self, args, options);
            },
            function spawn_git(self, command_args, command_options, callback){
                logger.info('spawning "git '+command_args.join(' ')+'"');
                var command = child_process.spawn("git", command_args, command_options);
                Build.find_by_id(current_build.__id__, function(err, build) {
                    build.fetching_started_at = new Date();
                    build.save(function(err){
                        callback(err, self, command, command_args);
                    });
                });
            },
            function capture_git_stdout(self, command, args, callback){
                logger.debug('capturing the git command stdout');
                command.stdout.on('data', function (data) {
                    Build.find_by_id(current_build.__id__, function(err, build) {
                        logger.handleException("Build.find_by_id", err);
                        build.stage = STAGES_BY_NAME.FETCHING;
                        build.save(function(err){
                            logger.handleException("build(#"+build.__id__+").save", err);
                        });
                    });
                });
                callback(null, self, command, args);
            },
            function capture_git_stderr(self, command, args, callback){
                logger.debug('capturing the git command stderr');
                command.stderr.on('data', function (data) {
                    var regex = /([a-zA-Z0-9 ]+)[:]\s*(\d+[%])/g;
                    var raw_string = data.toString();
                    var found = regex.exec(raw_string);
                    Build.find_by_id(current_build.__id__, function(err, build) {
                        logger.handleException("Build.find_by_id", err);
                        build.stage = STAGES_BY_NAME.FETCHING;
                        build.save(function(err){
                            logger.handleException("build(#"+build.__id__+").save", err);
                        });
                    });
                    if (found) {
                        logger.debug('publishing signal')
                        redis.publish('Repository being fetched', JSON.stringify({
                            instruction: self.non_circular_data,
                            phase: found[1].toLowerCase(),
                            percentage: found[2]
                        }));
                    }
                });
                callback(null, self, command, args);
            },
            function handle_the_exit_of_git(self, command, args, callback) {
                logger.debug('capturing the exit of the git command');
                command.on('exit', function (code, signal) {
                    logger.debug(['git has exited |', 'exit code:', code, " SIGNAL:", signal]);
                    Build.find_by_id(current_build.__id__, function(err, build) {
                        logger.handleException("Build.find_by_id", err);
                        var now = new Date();

                        build.status = code;
                        build.fetching_finished_at = now;
                        build.stage = STAGES_BY_NAME.PREPARING_ENVIRONMENT;

                        redis.publish("Repository finished fetching", JSON.stringify({at: now, build:build.__data__, instruction: self.__data__}));
                        build.save(function(err){
                            logger.handleException("build(#"+build.__id__+").save", err);
                            callback(null, self);
                        });
                    });
                });
            },
            function write_build_script(self, callback){
                var now = new Date();
                logger.debug('writting build script at ' + script_path);
                var parts = ["#!/bin/bash"];
                self.build_script.split(/[\n\r\t\s]*$/gm).forEach(function(line){
                    parts.push(line.trim() + '; [ $? != 0 ] && exit $?;');
                });
                parts.push("\necho 'this build was ran by emerald at " + now.toUTCString() + "';\n");
                parts.push("exit 0");
                var content = parts.join("\n");
                fs.writeFile(script_path, content, function(err){
                    callback(err, self);
                });
            },
            function make_it_writtable(self, callback){
                logger.debug('adding execution permission on the build script');
                fs.chmod(script_path, 0755, function(err){
                    callback(err, self);
                });
            },
            function spawn_build_script(self, callback){
                logger.info('spawning build script');
                var args = [script_path];
                var command = child_process.spawn("bash", args, {cwd: repository_full_path});
                Build.find_by_id(current_build.__id__, function(err, build) {
                    build.build_started_at = new Date();
                    build.save(function(err){
                        callback(err, self, command, args);
                    });
                });
            },
            function capture_build_stdout (self, command, args, callback){
                logger.debug('capturing build script stdout');
                command.stdout.on('data', function (data) {
                    Build.find_by_id(current_build.__id__, function(err, build) {
                        var b = filter_output(data.toString());
                        var already_there = (build.output.indexOf(b) > 0);
                        if (already_there){return;}
                        build.output = build.output + b;
                        build.stage = STAGES_BY_NAME.RUNNING;
                        redis.publish("Build output", JSON.stringify({meta: build.__data__, output: build.output, instruction: self.non_circular_data}));

                        build.save(function(err, key, build) {
                            logger.debug('persisting "'+b+'" to Build#'+build.__id__+'\'s "output" field');
                        });
                    });
                });
                callback(null, self, command, args);
            },
            function capture_build_stderr (self, command, args, callback){
                logger.debug('capturing build script stderr');
                command.stderr.on('data', function (data) {
                    var b = filter_output(data.toString());
                    Build.find_by_id(current_build.__id__, function(err, build) {
                        var already_there = (build.error.indexOf(b) > 0);
                        if (already_there) {return;}

                        build.error = build.error + b;
                        build.stage = STAGES_BY_NAME.RUNNING;

                        redis.publish("Build output", JSON.stringify({meta: build.__data__, output: build.error, instruction: self.non_circular_data}));
                        build.save(function(err, key, build) {
                            logger.debug('persisting "'+b+'" to Build#'+build.__id__+'\'s "error" field');
                        });
                    });
                });
                callback(null, self, command, args);
            },
            function handle_the_exit_of_build(self, command, args, callback) {
                var now = new Date();
                logger.debug('handling the exit of the command');

                command.on('exit', function (code, signal) {
                    logger.debug('finished running the build script, code: ' + code + ', signal: ' + signal);
                    Build.find_by_id(current_build.__id__, function(err, build) {
                        build.status = code;
                        build.signal = signal;
                        build.build_finished_at = now;
                        build.stage = STAGES_BY_NAME.FINISHED;

                        var instruction_without_builds = self.non_circular_data;
                        delete instruction_without_builds.builds;
                        redis.publish("Build finished", JSON.stringify({meta: build.__data__, at: now, instruction: instruction_without_builds}));
                        build.save(function(){
                            lock.release(function(){
                                callback(null, self);
                            });
                        });
                    });
                });
            }
        ], function(err){
            if (err){
                lock.release(function(){
                    logger.fail(err.toString())
                })
            }
        });
    });
});

var Pipeline = models.declare("Pipeline", function(it, kind) {
    it.has.field("name", kind.string);
    it.has.many("instructions", BuildInstruction, "pipeline");

    it.validates.uniquenessOf("name");

    it.has.getter('permalink', function(){
        return '/pipeline/' + this.__id__;
    });
});

module.exports = {
    User: User,
    BuildInstruction: BuildInstruction,
    Build: Build,
    Pipeline: Pipeline,
    connection: User._meta.storage.connection,
    storage: User._meta.storage,
    clear_keys: function(pattern, callback) {
        var self = this;
        var pattern_list = (pattern instanceof Array) ? pattern: [pattern];
        var exception;
        var key_list = [];

        pattern_list.forEach(function(pattern){
            self.connection.keys(pattern, function(err, keys){
                if (err) {exception = err;return;}
                keys.forEach(function(key) {key_list.push(key);});

                if (pattern === pattern_list.last) {
                    self.connection.del(key_list ,function(err) {
                        return callback(exception, key_list);
                    });
                }
            });
        });
    },
    STAGES_BY_INDEX: STAGES_BY_INDEX,
    STAGES_BY_NAME: STAGES_BY_NAME
}
