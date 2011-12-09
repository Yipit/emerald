require('colors');
var settings = require('./settings');
var loglevel = {
    DEBUG: 4,
    SUCCESS: 3,
    INFO: 2,
    FAIL: 1,
    CRITICAL: 0
}

function Logger (prefix) {
    level = settings.LOG_LEVEL || loglevel.SUCCESS;

    this.prefix = "   [EMERALD] ".green + prefix;

    this.info = function(parts) {
        if (level < 2) return;
        var msg = (parts instanceof Array) && JSON.stringify(parts) || parts;
        console.log(this.prefix, "INFO:".cyan.bold, msg, "@", this.timestamp());
    };
    this.debug =  function(parts) {
        if (level < 4) return;
        var msg = (parts instanceof Array) && JSON.stringify(parts) || parts;
        console.log(this.prefix, "DEBUG:".yellow.bold, msg, "@", this.timestamp());
    };
    this.success =  function(parts) {
        if (level < 3) return;
        var msg = (parts instanceof Array) && JSON.stringify(parts) || parts;
        console.log(this.prefix, msg.green.bold, "@", this.timestamp());
    };
    this.fail = function(parts) {
        if (level < 1) return;
        var msg = (parts instanceof Array) && JSON.stringify(parts) || parts;
        console.log(this.prefix, msg.red.bold, "@", this.timestamp());
    };
    this.timestamp = function(){
        return (new Date()).toTimeString().yellow.bold;
    };
}
Logger.levels = loglevel;
exports.Logger = Logger;