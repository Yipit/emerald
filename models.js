var models = require('clay');
var crypto = require('crypto');

var Build = models.declare("Build", function(it, kind){
    it.has.field("status", kind.numeric);
    it.has.field("error", kind.string);
    it.has.field("output", kind.string);
    it.has.field("pid", kind.number);
    it.has.field("commit", kind.string);
    it.has.field("author_name", kind.string);
    it.has.field("author_email", kind.string);
});

var BuildInstruction = models.declare("BuildInstruction", function(it, kind){
    it.has.field("name", kind.string);
    it.has.field("description", kind.string);
    it.has.field("repository_address", kind.string);
    it.has.field("build_command", kind.string);

    it.validates.uniquenessOf("name");

    it.has.index("repository_address");
    it.has.many("builds", Build, "instruction");

    it.has.getter('permalink', function(){
        return '/instruction/' + this.__id__;
    });
});

module.exports.prepare = function(io, app){
    return {
        BuildInstruction: BuildInstruction,
        Build: Build
    }
}
