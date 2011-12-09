var models = require('clay');
var crypto = require('crypto');
var child_process = require('child_process');

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
        hash.update(this.email);
        return 'http://www.gravatar.com/avatar/' + hash.digest('hex') + '?s=' + size;
    });

    it.has.method('authenticate', function(attempt, callback){
        if (attempt === this.password) {
            return callback(null, this);
        } else {
            return callback(new Error('wrong password for the login "' + this.email + '"'), null);
        }
    });
});

User.authenticate = function(login, password, callback){
    if (!login) {
        return callback(new Error("Invalid email: " + login))
    }
    User.find_by_email(new RegExp(login), function(err, items){
        var found = items.first;
        if (err) {
            return callback(new Error('there are no users matching the email "' + login + '"'));
        }
        return found.authenticate(password, callback);
    });
}

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

        var clone_command = ["clone", "--porcelain", self.repository_address];
        var git_clone = child_process.spawn("git", clone_command);

        git_clone.stdout.on('data', function (data) {
            logger.info();
            Build.find_by_id(current_build.__id__, function(err, build) {
                build.output = build.output + data;
                build.save(function(err, key, build){
                    self._meta.storage.connection.publish("emerald:Build:" + build.__id__ + ":stdout", data);
                    self._meta.storage.connection.publish("emerald:Build:stdout", build.__data__);
                });
            });
        });
        git_clone.stderr.on('data', function (data) {
            Build.find_by_id(current_build.__id__, function(err, build) {
                build.error = build.error + data;
                build.save(function(err, key, build){
                    self._meta.storage.connection.publish("emerald:Build:" + build.__id__ + ":stderr", data);
                    self._meta.storage.connection.publish("emerald:Build:stderr", build.__data__);
                });
            });
        });
        git_clone.on('exit', function (_code) {
            var code = parseInt(git_clone.pid);

            lock.release(function() {
                Build.find_by_id(current_build.__id__, function(err, build){
                    logger.handleException("Build.find_by_id", err);
                    console.log("Build:", build, "code:", code);
                    build.pid = code;
                    build.save(function(err, key, build){
                        self._meta.storage.connection.publish("emerald:BuildFinished", build.__data__)
                    });
                });
            });
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
