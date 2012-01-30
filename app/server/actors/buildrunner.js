var _ = require('underscore')._;
var crypto = require('crypto');
var async = require('async');
var path = require('path');
var fs = require('fs');
var child_process = require('child_process');
var logger = new (require('../logger').Logger)("[ BUILD RUNNER ]".yellow.bold);

var entity = require('../models');
var Build = entity.Build;
var BuildInstruction = entity.BuildInstruction;
var Lock = require('../lock').Lock;

function filter_output (text) {
    return text.replace(/\x1B\[([0-9]{1,2}(;[0-9]{1,2})?)?[m|K]/g, '');
}

function BuildRunner (current_build){
    this.current_build = current_build;
    this.instruction = current_build.instruction;
    this.redis = current_build._meta.storage.connection;
    this.lock = new Lock(settings.REDIS_KEYS.current_build, this.redis);
}

BuildRunner.prototype.generate_script_name = function(){
    var hash = crypto.createHash('md5');

    hash.update([
        this.instruction.name,
        this.instruction.__id__ + "",
        this.current_build.__id__ + ""
    ].join("@"));

    return (hash.digest('hex') + '.sh');
}

BuildRunner.prototype.get_script_contents = function(){
    var parts = ["#!/bin/bash"];
    this.instruction.build_script.split(/[\n\r\t\s]*$/gm).forEach(function(line){
        parts.push(line.trim() + ' || exit $? || printf "\\n\\n\\n";');
    });
    return parts.join("\n\n###############################################################################\n\n");
}

BuildRunner.prototype.start = function(){
    var self = this;

    var current_build = self.current_build;
    var instruction = self.instruction;

    var redis = self.redis;
    /* TODO: extract the repo name and check if already exists e*/
    var repository_folder_name = [instruction.repository_address, instruction.name].join('-')
        .replace(/\W+/g, '-')
        .toLowerCase()
        .replace(/[-]?\bgit\b[-]?/g, '')

    var repository_full_path = path.join(settings.SANDBOX_PATH, repository_folder_name);
    var repository_bare_path = path.join(repository_full_path, '.git');

    var script_name = self.generate_script_name();
    var script_path = path.join(repository_full_path, script_name);

    var branch_to_build = instruction.branch || "master";
    redis.publish("Build started", JSON.stringify({
        build: current_build.toBackbone(),
        instruction: instruction.toBackbone()
    }));

    async.waterfall([
        function decide_whether_pull_or_clone (callback){
            logger.info('preparing to fetch data from "'+instruction.name+'" through "'+instruction.repository_address+'@'+branch_to_build+'" at ' + repository_full_path);
            path.exists(repository_bare_path, function(exists){callback(null, instruction, exists)});
        },
        function assemble_the_command_line (instruction, exists, callback) {
            var args, options = {};
            if (exists) {
                args = ["pull", "origin", branch_to_build || "master"];
                options.cwd = repository_full_path;
                logger.info('found an existing git repo at "'+repository_bare_path+'", gonna use git-pull');
            } else {
                args = ["clone", "--progress", instruction.repository_address, repository_folder_name];
                logger.info('local copy does not exist, will clone at "'+repository_full_path+'"');
                options.cwd = settings.SANDBOX_PATH;
            }
            callback(null, instruction, args, options);
        },
        function spawn_git(instruction, command_args, command_options, callback){
            logger.info('spawning "git '+command_args.join(' ')+'"');
            var command = child_process.spawn("git", command_args, command_options);
            var now = new Date();

            current_build.fetching_started_at = now;
            current_build.stage = entity.STAGES_BY_NAME.FETCHING;
            current_build.save(function(err, key, build){
                redis.publish('Repository started fetching', JSON.stringify({
                    at: now,
                    build: build.toBackbone(),
                    instruction: instruction.toBackbone()
                }));
                callback(err, build, instruction, command, command_args);
            });
        },
        function capture_git_stderr(build, instruction, command, args, callback){
            logger.debug('capturing the git command stderr');
            command.stderr.on('data', function (data) {
                var regex = /([a-zA-Z0-9 ]+)[:]\s*(\d+[%])/g;
                var raw_string = data.toString();
                var found = regex.exec(raw_string);

                if (found) {
                    redis.publish('Repository being fetched', JSON.stringify({
                        instruction: instruction.toBackbone(),
                        build: build.toBackbone(),
                        phase: found[1].toLowerCase(),
                        percentage: found[2]
                    }));
                }

            });
            callback(null, build, instruction, command, args);
        },
        function handle_the_exit_of_git(build, instruction, command, args, callback) {
            logger.debug('emerald will handle the exit of the git command');
            command.on('exit', function (code, signal) {
                logger.debug(['git has exited |', 'exit code:', code, " SIGNAL:", signal]);
                Build.fetch_by_id(current_build.__id__, function(err, build) {
                    logger.handleException("Build.find_by_id", err);
                    var now = new Date();

                    build.fetching_finished_at = now;
                    build.stage = entity.STAGES_BY_NAME.PREPARING_ENVIRONMENT;

                    redis.publish("Repository finished fetching", JSON.stringify({
                        at: now,
                        build:build.toBackbone(),
                        instruction: instruction.toBackbone()
                    }));
                    build.save(function(err, key, build){
                        logger.handleException("build(#"+build.__id__+").save", err);
                        callback(null, build, instruction);
                    });
                });
            });
        },
        function update_builds_author(build, instruction, callback){
            child_process.exec('git log --format=full HEAD...HEAD^', {cwd: repository_full_path}, function(error, stdout, stderr){
                var lines = _.map(stdout.split('\n'), function(x){return x.trim()});
                var author_data = /(Author|Commit)[:] ([^<]+)[<]([^>]+)[>]/i.exec(stdout);
                var commit_hash = /commit (\w{40})/.exec(lines[0]);
                var commit_message = (stdout.split('\n').splice(4).join('\n')).trim();

                async.waterfall([
                    function set_author_name (callback){
                        if (author_data) {
                            var parsed_name = author_data[2].trim();
                            build.set("author_name", parsed_name, callback);
                        } else {
                            callback(null, "author_name", null, build);
                        }
                    },
                    function set_author_email (name, value, build, callback){
                        if (author_data) {
                            var parsed_email = author_data[3].trim();
                            build.set("author_email", parsed_email, callback);
                        } else {
                            callback(null, "author_email", null, build);
                        }
                    },
                    function set_commit_hash (name, value, build, callback){
                        if (commit_hash) {
                            build.set("commit", commit_hash[1], callback);
                        } else {
                            callback(null, "commit", null, build);
                        }
                    },
                    function set_commit_message (name, value, build, callback){
                        if (commit_message.length > 0) {
                            build.set("message", commit_message, callback);
                        } else {
                            callback(null, "message", null, build);
                        }
                    }

                ], function(err, name, value, build){
                    callback(err, build, instruction);
                });


            });
        },
        function write_build_script(build, instruction, callback){
            logger.debug('writting build script at ' + script_path);
            fs.writeFile(script_path, self.get_script_contents(), function(err){
                callback(err, build, instruction);
            });
        },
        function make_it_writtable(build, instruction, callback){
            logger.debug('adding execution permission on the build script');
            fs.chmod(script_path, 0755, function(err){
                callback(err, build, instruction);
            });
        },
        function spawn_build_script(build, instruction, callback){
            logger.info('spawning build script');
            var args = [script_path];
            var command = child_process.spawn("bash", args, {cwd: repository_full_path});

            current_build.build_started_at = new Date();
            current_build.save(function(err){
                callback(err, build, instruction, command, args);
            });
        },
        function capture_build_stdout (build, instruction, command, args, callback){
            logger.debug('capturing build script stdout');
            command.stdout.on('data', function (data) {
                build.increment_stdout(data.toString(), function(err, full, current, appended){
                    if (err) {
                        logger.warning(msg);
                    }
                    var envelope = JSON.stringify({
                        build: current_build.toBackbone(),
                        instruction: instruction.toBackbone(),
                        current: current,
                        full: full,
                        appended: appended,
                    });
                    redis.publish("Build stdout", envelope);
                    redis.publish("Build output", envelope);
                });
            });
            callback(null, build, instruction, command, args);
        },
        function capture_build_stderr (build, instruction, command, args, callback){
            logger.debug('capturing build script stderr');
            command.stderr.on('data', function (data) {
                build.increment_stderr(data.toString(), function(err, full, current, appended){
                    if (err) {
                        logger.warning(msg);
                    }
                    var envelope = JSON.stringify({
                        build: current_build.toBackbone(),
                        instruction: instruction.toBackbone(),
                        current: current,
                        full: full,
                        appended: appended,
                    });
                    redis.publish("Build stderr", envelope);
                    redis.publish("Build output", envelope);
                });
            });
            callback(null, build, instruction, command, args);
        },
        function handle_the_exit_of_build(old_build, instruction, command, args, callback) {
            var now = new Date();
            logger.debug('emerald will handle the exit of the command');

            command.on('exit', function (code, signal) {
                logger.debug('finished running the build script, code: ' + code + ', signal: ' + signal);
                Build.fetch_by_id(old_build.__id__, function(err, build) {
                    build.status = code;
                    build.signal = signal;
                    build.build_finished_at = now;
                    build.stage = build.succeeded ? entity.STAGES_BY_NAME.SUCCEEDED : entity.STAGES_BY_NAME.FAILED;

                    build.save(function(err, key, build) {
                        callback(null, build, instruction);
                    });
                });
            });
        },
        function associate_build_to_instruction(build, instruction, callback){
            /* the unix timestamp is always the score, so that we can fetch it ordered by date*/
            var unix_timestamp = (new Date()).getTime();

            redis.zadd(instruction.keys.all_builds, unix_timestamp, instruction.keys.for_build_id(current_build.__id__), function(){
                callback(null, build, instruction, unix_timestamp);
            })
        },
        function associate_build_to_proper_list(build, instruction, unix_timestamp, callback){
            var exit_code_zero = parseInt(build.status || 0) == 0;
            var was_not_killed = build.signal === "null";

            var build_succeeded = exit_code_zero && was_not_killed;
            var key = build_succeeded ? instruction.keys.succeeded_builds : instruction.keys.failed_builds;
            var name = build_succeeded ? 'succeeded' : 'failed';

            redis.zadd(key, unix_timestamp, instruction.keys.for_build_id(build.__id__), function(){
                logger.info(['adding Build #' + build.__id__, 'to Instruction #' + instruction.__id__ + "'s", name, 'builds list'])
                callback(null, build, instruction);
            });
        }
    ], function(err, build, instruction){
        if (err) {
            logger.fail(err.toString());
            logger.fail(err.stack.toString());
        } else {
            logger.success('the instruction "'+instruction.name+'" has finished running its build #' + build.index);
        }

        redis.publish("Build finished", JSON.stringify({
            build: build.toBackbone(),
            instruction: instruction.toBackbone()
        }));

        self.lock.release(function(){
            logger.success(['the build lock was released', err && 'due an error'.red || 'successfully'.green.bold]);
        })

    });
}
exports.BuildRunner = BuildRunner;
