var models = require('clay');
var crypto = require('crypto');

BUILD_STAGES = {
    0: 'FETCHING',
    1: 'RUNNING',
    2: 'FINISHED'
}
var User = models.declare("User", function(it, kind){
    it.has.field("name", kind.string);
    it.has.field("email", kind.email);
    it.has.field("password", kind.hashOf(["name", "email"]));

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

    it.has.method('authenticate', function(password, callback){
        var candidate = this._meta.field.definitions["password"](null, this, password);
        var matched = candidate === this.password;
        if (matched) {
            return callback(null, this);
        } else {
            return callback(new Error("password mismatch for " + this.email), null);
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
            return callback(new Error("Invalid email: " + login))
        }
        return found.authenticate(password, callback);
    });
}
var Build = models.declare("Build", function(it, kind) {
    it.has.field("status", kind.numeric);
    it.has.field("error", kind.string);
    it.has.field("output", kind.string);
    it.has.field("pid", kind.number);
    it.has.field("stage", kind.number);
    it.has.field("commit", kind.string);
    it.has.field("author_name", kind.string);
    it.has.field("author_email", kind.string);

    it.has.getter('permalink', function(){
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

    it.has.getter('permalink', function(){
        return '/instruction/' + this.__id__;
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
    clear_keys: function(pattern, callback){
        var self = this;
        self.connection.keys("clay:*", function(err, keys){
            if (err) {return callback(err);}
            self.connection.del(keys, function(err){
                return callback(err, keys);
            });
        });
    }
}
