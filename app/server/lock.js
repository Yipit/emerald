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
var logger = new (require('./logger').Logger)("[LOCK]".blue.bold);
var Build = require('./models').Build;

function LockHandle (lock) {
    this.__lock__ = lock;
    this.release = function(){
        lock.release.apply(lock, arguments);
    };
}
LockHandle.prototype.lock = function(value, callback){
    var self = this;
    this.__lock__.redis.set(this.__lock__.key, value, function(err){
        if (err) {return self.__lock__.release();}
        callback();
    });
};

function Lock(key, redis){
    this.key = key;
    this.redis = redis;
    this.locked = false;
    this.handle = new LockHandle(this);
}

Lock.prototype.acquire = function(acquired_callback){
    var self = this;
    self.redis.get(this.key, function(err, current_build_id){
        logger.handleException(err, 'Lock.acquire() -->> redis.get(' + self.key + ')');
        logger.debug(["redis.get('"+self.key+"')", arguments]);

        /* if not building, let's quit and wait for the next interval */
        if (current_build_id) {
            err = new Error("the build #" + current_build_id + " is already running");
        }
        return acquired_callback(err, self.handle);
    });
};

Lock.prototype.release = function(callback){
    var self = this;
    this.redis.del(this.key, function(err, num){
        logger.handleException(err, 'Lock.release() -->> redis.del(' + self.key + ')');
        if (err || (parseInt(num, 10) < 1)) {return;}
        return callback && callback(new Date());
    });
};

exports.Lock = Lock;
exports.LockHandle = LockHandle;
exports.logger = logger;
