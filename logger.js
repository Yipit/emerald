require('colors');
var _ = require("underscore")._;
var settings = require('./settings');
var loglevel = {
    DEBUG: 4,
    SUCCESS: 3,
    INFO: 2,
    FAIL: 1,
    CRITICAL: 0
}

function Logger (prefix) {
    var self = this;

    this.level = settings.LOG_LEVEL || loglevel.SUCCESS;

    this.prefix = "   [EMERALD] ".green + prefix;
    this.log = function(prefix, parts){
        var msg = [this.prefix, prefix];
        if (parts instanceof Array) {
            _.each(parts, function(x) {msg.push(x);});
        } else {
            msg.push(parts);
        }
        msg.push(this.timestamp());
        console.log.apply(console, msg);
    }

    this.info = function(parts) {
        if (self.level < 2) return;
        this.log("INFO:".cyan.bold, parts);
    };
    this.debug =  function(parts) {
        if (self.level < 4) return;
        this.log("DEBUG:".yellow.bold, parts);
    };
    this.success =  function(parts) {
        if (self.level < 3) return;
        this.log("SUCCESS:".green.bold, parts);
    };
    this.fail = function(parts) {
        if (self.level < 1) return;
        this.log("FAILURE:".red, parts);
    };
    this.warning = function(parts) {
        if (self.level < 1) return;
        this.log("WARNING:".red.bold, parts);
    };
    this.handleException = function(where, exc){
        if (exc) {
            this.fail(["@", where, exc]);
        }
    }
    this.timestamp = function(){
        return ("@"+(new Date()).toTimeString()).white.bold;
    };
}
Logger.levels = loglevel;
exports.Logger = Logger;