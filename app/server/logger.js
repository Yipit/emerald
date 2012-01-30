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
require('colors');
var _ = require('underscore')._;
var loglevel = {
    DEBUG: 4,
    SUCCESS: 3,
    INFO: 2,
    FAIL: 1,
    CRITICAL: 0
}

function Logger (prefix) {
    var self = this;

    self.level = settings.LOG_LEVEL || loglevel.SUCCESS;

    self.prefix = "   [EMERALD] ".green + prefix;
    self.log = function(prefix, parts){
        var msg = [self.prefix, prefix];
        if (parts instanceof Array) {
            _.each(parts, function(x) {msg.push(x);});
        } else {
            msg.push(parts);
        }
        msg.push(self.timestamp());
        console.log.apply(console, msg);
    }

    function action(minimum_level, fn){
        if (self.level < minimum_level) return function(){};
        return fn;
    }
    self.info = action(loglevel.INFO, function(parts) {
        self.log("INFO:".cyan.bold, parts);
    });
    self.debug = action(loglevel.DEBUG, function(parts) {
        self.log("DEBUG:".yellow.bold, parts);
    });
    self.success = action(loglevel.SUCCESS, function(parts) {
        self.log("SUCCESS:".green.bold, parts);
    });
    self.fail = action(loglevel.FAIL, function(parts) {
        self.log("FAILURE:".red, parts);
    });
    self.warn = self.warning = action(loglevel.FAIL, function(parts) {
        self.log("WARNING:".red.bold, parts);
    });
    self.handleException = function(where, exc){
        if (exc) {
            self.fail(["@", where, exc, '\n', exc.stack + ""]);
        }
    }
    self.timestamp = function(){
        return ("@"+(new Date()).toTimeString()).white.bold;
    };
}
Logger.levels = loglevel;
exports.Logger = Logger;
