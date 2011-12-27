var models = require('clay');
var crypto = require('crypto');
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

        var start_time = new Date();
        var redis = self._meta.storage.connection;
        /* TODO: extract the repo name and check if already exists e*/
        var repository_folder_name = (self.repository_address + self.name).replace(/\W+/g, '');
        var repository_full_path = path.join(settings.SANDBOX_PATH, repository_folder_name);
        var branch_to_build = self.branch || "master";
        redis.publish("Build started", JSON.stringify({
            build: current_build.__data__,
            instruction: self.__data__
        }));
        async.waterfall([
            function(callback){
                logger.info('preparing to fetch data from "'+self.name+'" through "'+self.repository_address+'@'+branch_to_build+'" at ' + repository_full_path);
                require('path').exists(repository_full_path, function(exists){callback(null, exists)})
            },
            function(exists, callback) {
                var args, options = {};
                if (exists) {
                    args = ["pull", "origin", branch_to_build || "master"];
                    options.cwd = repository_full_path;
                    logger.info('found an existing folder at "'+repository_full_path+'", gonna use git-pull');
                } else {
                    args = ["clone", "--progress", self.repository_address, repository_folder_name];
                    logger.info('local copy does not exist, will clone at "'+repository_full_path+'"');
                    options.cwd = settings.SANDBOX_PATH;
                }
                callback(null, args, options);
            },
            function spawn_the_command(command_args, command_options, callback){
                logger.info('spawning "git '+command_args.join(' ')+'"');
                var command = child_process.spawn("git", command_args, command_options);
                callback(null, command);
            },
            function listen_to_stdout(command, callback){
                command.stdout.on('data', function (data) {
                    Build.find_by_id(current_build.__id__, function(err, build) {
                        build.output = build.output + data;
                        build.save(function(err, key, build){
                            redis.publish("emerald:Build:" + build.__id__ + ":stdout", data.toString());
                            redis.publish("Build output", {meta: build.__data__, output: build.output});
                        });
                    });
                });
                callback(null, command);
            },
            function listen_to_stderr(command, callback){
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
                    var parsed = found && found[0] || raw_string;
                    Build.find_by_id(current_build.__id__, function(err, build) {
                        build.error = build.error + data;
                        build.save(function(err, key, build){
                            redis.publish("emerald:Build:" + build.__id__ + ":stderr", data.toString());
                            redis.publish("Build output", {meta: build.__data__, output: build.error});
                        });
                    });
                });
                callback(null, command);
            },
            function handle_on_exit(command, callback) {
                command.on('exit', function (_code) {
                    var code = parseInt(command.pid);
                    lock.release(function() {
                        Build.find_by_id(current_build.__id__, function(err, build){
                            logger.handleException("Build.find_by_id", err);
                            build.pid = code;
                            build.save(function(err, key, build){
                                redis.publish("Repository finished fetching", JSON.stringify(self.__data__))
                                callback(null);
                            });
                        });
                    });
                });
            }
        ]);
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
