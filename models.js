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
});

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
    redis: User._meta.storage.connection
}
