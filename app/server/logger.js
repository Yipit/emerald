/***************************************************************************
Emerald - Continuous Integration server focused on real-time interactions
Copyright (C) <2012>  Gabriel Falcão <gabriel@yipit.com>
Copyright (C) <2012>  Yipit Inc. <coders@yipit.com>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
 ***************************************************************************/
var _ = require('underscore')._;
var loglevel = {
    DEBUG: 4,
    SUCCESS: 3,
    INFO: 2,
    FAIL: 1,
    CRITICAL: 0
};

function Logger (prefix) {
    var self = this;

    this.level = settings.LOG_LEVEL || loglevel.SUCCESS;

    this.prefix = "   [EMERALD] ".green + prefix;
    this.log = function(prefix, parts){
        if (settings.SHUT_UP) {
            /* emerald, be quiet please! */
            return;
        }
        var msg = [this.prefix, prefix];
        if (parts instanceof Array) {
            _.each(parts, function(x) {msg.push(x);});
        } else {
            msg.push(parts);
        }
        msg.push(this.timestamp());
        console.log.apply(console, msg);
    };

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
    this.warn = this.warning = function(parts) {
        if (self.level < 1) return;
        this.log("WARNING:".red.bold, parts);
    };
    this.handleException = function(exc, where){
        if (exc) {
            this.fail(["@", where, exc, '\n', exc.stack + ""]);
        }
    };
    this.timestamp = function(){
        return ("@"+(new Date()).toTimeString()).white.bold;
    };
}
Logger.levels = loglevel;
exports.Logger = Logger;
