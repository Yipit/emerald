var _ = require('underscore')._;
var models = require('clay');
var crypto = require('crypto');
var mkdirp = require('mkdirp');
var async = require('async');
var moment = require('moment');
var path = require('path');
var fs = require('fs');
var child_process = require('child_process');
var settings = require('./settings');
var logger = new (require('./logger').Logger)("[ MODELS / RUNNER ]".green.bold);

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

var Build = models.declare("Build", function(it, kind) {
    it.has.field("status", kind.string);
    it.has.field("signal", kind.string);
    it.has.field("error", kind.string);
    it.has.field("output", kind.string);
    it.has.field("pid", kind.numeric);
    it.has.field("stage", kind.numeric);
    it.has.field("commit", kind.string);
    it.has.field("message", kind.string);
    it.has.field("author_name", kind.string);
    it.has.field("author_email", kind.string);
    it.has.field("build_started_at", kind.auto);
    it.has.field("build_finished_at", kind.string);
    it.has.field("fetching_started_at", kind.auto);
    it.has.field("fetching_finished_at", kind.string);

    it.has.method('gravatar_of_size', function(size){
        var hash = crypto.createHash('md5');
        hash.update(this.author_email || '');
        return 'http://www.gravatar.com/avatar/' + hash.digest('hex') + '?s=' + size;
    });
    it.has.getter('succeeded', function() {
        return ((parseInt(this.status || 0) == 0) && this.signal === 'null');
    });
    it.has.getter('stage_name', function() {
        return (STAGES_BY_NAME[this.stage] || 'running').toLowerCase();
    });

    it.has.getter('duration', function() {
        var finished = moment(this.finished_at);
        return finished.fromNow()
    });

    it.has.getter('started_at', function() {
        return this.build_started_at || this.fetching_started_at;
    });

    it.has.getter('finished_at', function() {
        return this.build_finished_at || this.fetching_finished_at;
    });

    it.has.getter('permalink', function() {
        return '/build/' + this.__id__;
    });

    it.has.class_method('from_key', function(key, callback) {
        var id = /(Build[:])?(\d+)$/.exec(key.trim())[2];
        Build.find_by_id(parseInt(id), function(err, item){
            callback(err, item);
        });
    });
    it.has.method('toBackbone', function() {
        var data = this.__data__;
        data.id = data.__id__;
        data.gravatar = this.gravatar_of_size(50);
        data.style_name = this.succeeded ? 'success': 'failure';
        data.stage_name = this.stage_name;
        data.route = "#build/" + data.__id__;
        return data;
    });
});

var BuildInstruction = models.declare("BuildInstruction", function(it, kind) {
    it.has.field("name", kind.string);
    it.has.field("description", kind.string);
    it.has.field("repository_address", kind.string);
    it.has.field("branch", kind.string);
    it.has.field("build_script", kind.string);

    it.has.getter('permalink', function() {
        return '/instruction/' + this.__id__;
    });

    it.has.getter('last_build', function() {
        return this.all_builds[0];
    });
    it.has.getter('last_success', function() {
        return this.succeeded_builds[0];
    });
    it.has.getter('last_failure', function() {
        return this.failed_builds[0];
    });

    it.has.getter('keys', function() {
        var prefix = 'emerald:Instruction:' + this.__id__ + ':';
        return {
            all_builds: prefix + 'all_builds',
            succeeded_builds: prefix + 'succeeded_builds',
            failed_builds: prefix + 'failed_builds',
            for_build_id: function(id){
                return 'Build:' + id;
            }
        };
    });
    it.has.method('toBackbone', function() {
        var self = this;
        var data = this.__data__;

        data.id = data.__id__;
        ['all_builds', 'succeeded_builds', 'failed_builds'].forEach(function(attribute){
            data[attribute] = self[attribute].map(function(b){ return b.toBackbone() });
        });

        return data;
    });
    it.has.class_method('fetch_by_id', function(id, callback) {
        var self = this;

        var redis = self._meta.storage.connection;

        async.waterfall([
            function fetch_instruction (callback){
                logger.debug('fetch_by_id: fetching raw data');
                return redis.hgetall('clay:BuildInstruction:id:' + id, callback);
            },
            function fetch_builds (data, callback){
                BuildInstruction.with_builds_from_data(data, callback);
            }
        ], callback);
    });

    it.has.class_method('get_latest_with_builds', function(callback) {
        var self = this;

        var redis = self._meta.storage.connection;

        async.waterfall([
            function fetch_all_instruction_keys (callback){
                logger.debug('get_latest_with_builds: getting keys');
                redis.keys('clay:BuildInstruction:id:*', callback);
            },
            function get_instructions_data (keys, callback){
                logger.debug(['get_latest_with_builds: getting data', keys]);
                async.map(keys, function(key, callback){
                    return redis.hgetall(key, callback);
                }, callback);
            },
            function turn_into_instructions (instructions, callback){
                logger.debug(['get_latest_with_builds: turning into instructions', instructions]);
                async.map(instructions, function(data, callback){
                    BuildInstruction.with_builds_from_data(data, callback);
                }, callback);
            },
            function backbone_them (instructions, callback){
                logger.debug(['get_latest_with_builds: turning into backbone-ish data', instructions]);
                async.map(instructions, function(i, callback){
                    callback(null, i.toBackbone());
                }, callback);
            }
        ], callback);
    });
    it.has.class_method('with_builds_from_data', function(data, callback) {
        var self = new this(data);
        function filter_builds(builds){
            return _.filter(builds, function(b){
                return !_.isNull(b) && !_.isUndefined(b); });
        }
        async.waterfall([
            function get_all_builds(callback) {
                redis.zrevrange(self.keys.all_builds, 0, -1, function(err, builds){
                    async.map(builds, function(key, callback){
                        return Build.from_key(key, callback);
                    }, function(err, builds){
                        callback(err, filter_builds(builds));
                    });
                });
            },
            function get_succeeded_builds(all_builds, callback) {
                redis.zrevrange(self.keys.succeeded_builds, 0, -1, function(err, builds){
                    async.map(builds, function(key, callback){
                        return Build.from_key(key, callback);
                    }, function(err, succeeded_builds){
                        callback(err, all_builds, filter_builds(succeeded_builds));
                    });
                });
            },
            function get_failed_builds(all_builds, succeeded_builds, callback) {
                redis.zrevrange(self.keys.failed_builds, 0, -1, function(err, builds){
                    async.map(builds, function(key, callback){
                        return Build.from_key(key, callback);
                    }, function(err, failed_builds){
                        callback(err, all_builds, succeeded_builds, filter_builds(failed_builds));
                    });
                });
            }
        ], function(err, all_builds, succeeded_builds, failed_builds){
            self.all_builds = all_builds;
            self.succeeded_builds = succeeded_builds;
            self.failed_builds = failed_builds;
            callback(err, self);
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
            build: current_build.toBackbone(),
            instruction: self.toBackbone()
        }));
        async.waterfall([
            function decide_whether_pull_or_clone (callback){
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
                    args = ["clone", "--progress", self.repository_address, repository_folder_name];
                    logger.info('local copy does not exist, will clone at "'+repository_full_path+'"');
                    options.cwd = settings.SANDBOX_PATH;
                }
                callback(null, self, args, options);
            },
            function spawn_git(self, command_args, command_options, callback){
                logger.info('spawning "git '+command_args.join(' ')+'"');
                var command = child_process.spawn("git", command_args, command_options);
                var now = new Date();
                Build.find_by_id(current_build.__id__, function(err, build) {
                    build.fetching_started_at = now;
                    build.pid = command.pid;
                    redis.publish('Repository started fetching', JSON.stringify({
                        at: now,
                        build:build.toBackbone(),
                        instruction: self.toBackbone()
                    }));
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

                        if (found) {
                            logger.debug('publishing signal')
                            redis.publish('Repository being fetched', JSON.stringify({
                                instruction: self.toBackbone(),
                                build: build.toBackbone(),
                                phase: found[1].toLowerCase(),
                                percentage: found[2]
                            }));
                        }
                    });
                });
                callback(null, self, command, args);
            },
            function handle_the_exit_of_git(self, command, args, callback) {
                logger.debug('emerald will handle the exit of the git command');
                command.on('exit', function (code, signal) {
                    logger.debug(['git has exited |', 'exit code:', code, " SIGNAL:", signal]);
                    Build.find_by_id(current_build.__id__, function(err, build) {
                        logger.handleException("Build.find_by_id", err);
                        var now = new Date();

                        build.status = code;
                        build.fetching_finished_at = now;
                        build.stage = STAGES_BY_NAME.PREPARING_ENVIRONMENT;

                        redis.publish("Repository finished fetching", JSON.stringify({
                            at: now,
                            build:build.toBackbone(),
                            instruction: self.toBackbone()
                        }));
                        build.save(function(err){
                            logger.handleException("build(#"+build.__id__+").save", err);
                            callback(null, self);
                        });
                    });
                });
            },
            function update_builds_author(self, callback){
                child_process.exec('git log --format=short HEAD...HEAD^', {cwd: repository_full_path}, function(error, stdout, stderr){
                    var lines = _.map(stdout.split('\n'), function(x){return x.trim()});
                    var author_data = /Author[:] ([^<]+)[<]([^>]+)[>]/.exec(lines[1]);
                    var commit_hash = /commit (\w{40})/.exec(lines[0]);
                    var commit_message = stdout.split('\n').splice(2).join('\n');

                    Build.find_by_id(current_build.__id__, function(err, build) {

                        build.author_name = author_data[1].trim();
                        build.author_email = author_data[2].trim();
                        build.commit = commit_hash[1];
                        build.message = commit_message;

                        build.save(function(err){
                            callback(err, self);
                        });

                    });
                });
            },
            function write_build_script(self, callback){
                var now = new Date();
                logger.debug('writting build script at ' + script_path);
                var parts = ["#!/bin/bash"];
                self.build_script.split(/[\n\r\t\s]*$/gm).forEach(function(line){
                    parts.push(line.trim() + '; [ $? != 0 ] && exit $? || printf "\\n\\n\\n";');
                });
                parts.push("exit 0;");
                var content = parts.join("\n\n###############################################################################\n\n");
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
                    build.pid = command.pid;
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
                        var already_there = (build.output.indexOf(b.trim()) > 0);
                        if (already_there){return;}
                        build.output = build.output + b;
                        build.stage = STAGES_BY_NAME.RUNNING;
                        redis.publish("Build output", JSON.stringify({meta: build.toBackbone(), output: b, instruction: self.toBackbone()}));

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

                        redis.publish("Build output", JSON.stringify({meta: build.toBackbone(), output: build.error, instruction: self.toBackbone()}));
                        build.save(function(err, key, build) {
                            logger.debug('persisting "'+b+'" to Build#'+build.__id__+'\'s "error" field');
                        });
                    });
                });
                callback(null, self, command, args);
            },
            function handle_the_exit_of_build(self, command, args, callback) {
                var now = new Date();
                logger.debug('emerald will handle the exit of the command');

                command.on('exit', function (code, signal) {
                    logger.debug('finished running the build script, code: ' + code + ', signal: ' + signal);
                    Build.find_by_id(current_build.__id__, function(err, build) {
                        build.status = code;
                        build.signal = signal;
                        build.build_finished_at = now;
                        build.stage = STAGES_BY_NAME.FINISHED;

                        build.save(function(){
                            lock.release(function(){
                                redis.publish("Build finished", JSON.stringify({
                                    at: now,
                                    build: build.toBackbone(),
                                    instruction: self.toBackbone()
                                }));
                                callback(null, self, build);
                            });
                        });
                    });
                });
            },
            function associate_build_to_instruction(self, build, callback){
                /* the unix timestamp is always the score, so that we can fetch it ordered by date*/
                var unix_timestamp = (new Date()).getTime();

                redis.zadd(self.keys.all_builds, unix_timestamp, self.keys.for_build_id(current_build.__id__), function(){
                    callback(null, self, build, unix_timestamp);
                })
            },
            function associate_build_to_proper_list(self, build, unix_timestamp, callback){
                var exit_code_zero = parseInt(build.status || 0) == 0;
                var was_not_killed = build.signal === "null";

                var build_succeeded = exit_code_zero && was_not_killed;
                var key = build_succeeded ? self.keys.succeeded_builds : self.keys.failed_builds;
                var name = build_succeeded ? 'succeeded' : 'failed';

                redis.zadd(key, unix_timestamp, self.keys.for_build_id(build.__id__), function(){
                    logger.info(['adding Build #' + build.__id__, 'to Instruction #' + self.__id__ + "'s", name, 'builds list'])
                    callback(null, self, build);
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

var default_storage = Build._meta.storage;

module.exports = {
    BuildInstruction: BuildInstruction,
    Build: Build,
    connection: default_storage.connection,
    storage: default_storage,
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
