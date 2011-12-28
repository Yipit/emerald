var models = require('clay');
var crypto = require('crypto');
var mkdirp = require('mkdirp');
var async = require('async');
var path = require('path');
var fs = require('fs');
var child_process = require('child_process');
var settings = require('./settings');
var logger = new (require('./logger').Logger)("[models]".cyan.bold);

BUILD_STAGES = {
    0: 'FETCHING',
    1: 'RUNNING',
    2: 'FINISHED'
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
    it.has.field("status", kind.numeric);
    it.has.field("error", kind.string);
    it.has.field("output", kind.string);
    it.has.field("pid", kind.numeric);
    it.has.field("stage", kind.numeric);
    it.has.field("commit", kind.string);
    it.has.field("author_name", kind.string);
    it.has.field("author_email", kind.string);
    it.has.field("started_at", kind.auto);

    it.has.getter('permalink', function() {
        return '/build/' + this.__id__;
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

    it.has.method('run', function(current_build, lock) {
        var self = this;

        var hash = crypto.createHash('md5');
        hash.update((new Date()).toString() + self.name);
        function filter_output (text) {
            return text.replace(/\x1B\[([0-9]{1,2}(;[0-9]{1,2})?)?[m|K]/g, '');
        }
        var start_time = new Date();
        var redis = self._meta.storage.connection;
        /* TODO: extract the repo name and check if already exists e*/
        var repository_folder_name = (self.repository_address + self.name).replace(/\W+/g, '');
        var repository_full_path = path.join(settings.SANDBOX_PATH, repository_folder_name);
        var repository_bare_path = path.join(repository_full_path, '.git');

        var script_name = hash.digest('hex') + '.sh';
        var script_path = path.join(repository_full_path, script_name);

        var branch_to_build = self.branch || "master";
        redis.publish("Build started", JSON.stringify({
            build: current_build.__data__,
            instruction: self.__data__
        }));
        async.waterfall([
            function decide_whether_pull_or_clone (callback){
                logger.info('preparing to fetch data from "'+self.name+'" through "'+self.repository_address+'@'+branch_to_build+'" at ' + repository_full_path);
                path.exists(repository_bare_path, function(exists){callback(null, exists)})
            },
            function assemble_the_command_line (exists, callback) {
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
                callback(null, args, options);
            },
            function spawn_git(command_args, command_options, callback){
                logger.info('spawning "git '+command_args.join(' ')+'"');
                var command = child_process.spawn("git", command_args, command_options);
                callback(null, command, command_args);
            },
            function capture_git_stderr(command, args, callback){
                command.stderr.on('data', function (data) {
                    var regex = /([a-zA-Z0-9 ]+)[:]\s*(\d+[%])/g;
                    var raw_string = data.toString();
                    var found = regex.exec(raw_string);

                    if (found) {
                        redis.publish('Repository being fetched', JSON.stringify({
                            instruction: self.__data__,
                            phase: found[1].toLowerCase(),
                            percentage: found[2]
                        }));
                    }
                });
                callback(null, command, args);
            },
            function handle_the_exit_of_git(command, args, callback) {
                command.on('exit', function (_code) {
                    var code = parseInt(_code || 0);
                    var err = code === 0 ? null : new Error('the build script "git ' + args.join(' ') + '" exited with status ' + _code);
                    return callback(err, command, args, code);
                });
            },
            function update_build_exit_code(command, args, code, callback){
                Build.find_by_id(current_build.__id__, function(err, build){
                    logger.handleException("Build.find_by_id", err);
                    if (err) {return callback(err);}
                    build.status = code;
                    build.save(function(err, key, build){
                        redis.publish("Repository finished fetching", JSON.stringify({instruction: self.__data__, build: build.__data__}))
                        callback(null);
                    });
                });
            },
            function write_build_script(callback){
                logger.debug('writting build script at ' + script_path);
                var parts = ["#!/bin/bash"];
                self.build_script.split(/[\n\r\t\s]*$/gm).forEach(function(line){
                    parts.push(line.trim() + '; [ $? != 0 ] && exit $?;');
                });
                parts.push("exit $?;");
                var content = parts.join("\n");
                fs.writeFile(script_path, content, function(err){
                    callback(err);
                });
            },
            function make_it_writtable(callback){
                logger.debug('adding execution permission on the build script');
                fs.chmod(script_path, 0755, function(err){
                    callback(err);
                });
            },
            function spawn_build_script(callback){
                logger.info('spawning build script');
                var args = [script_path];
                var command = child_process.spawn("bash", args, {cwd: repository_full_path});
                callback(null, command, args);
            },
            function capture_build_stdout (command, args, callback){
                logger.debug('capturing build script stdout');
                command.stdout.on('data', function (data) {
                    Build.find_by_id(current_build.__id__, function(err, build) {
                        var b = filter_output(data.toString());
                        build.output = (build.output.indexOf(b) > 0) ? b : (build.output + b);

                        build.save(function(err, key, build) {
                            redis.publish("Build output", JSON.stringify({meta: build.__data__, output: build.output, instruction: self.__data__}));
                        });
                    });
                });
                callback(null, command, args);
            },
            function capture_build_stderr (command, args, callback){
                logger.debug('capturing build script stderr');
                command.stderr.on('data', function (data) {
                    console.log(data.toString());
                    Build.find_by_id(current_build.__id__, function(err, build) {
                        build.error = filter_output(build.error + data.toString())

                        build.save(function(err, key, build) {
                            redis.publish("emerald:Build:" + build.__id__ + ":stderr", data.toString());

                        });
                    });
                });
                callback(null, command, args);
            },
            function handle_the_exit_of_build(command, args, callback) {
                logger.debug('handling the exit of the command');

                command.on('exit', function (_code) {
                    var code = parseInt(_code || 0);
                    logger.info('finished running the build script, code: ' + _code);
                    var err = code === 0 ? null : new Error('the build script "bash ' + args.join(' ') + '" exited with status ' + _code);
                    lock.release(function(){
                        callback(err);
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
    }
}
