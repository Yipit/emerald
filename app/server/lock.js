var logger = new (require('./logger').Logger)("[LOCK]".blue.bold);
var settings = require('../../settings');
var Build = require('./models').Build;

function LockHandle (lock) {
    this.__lock__ = lock;
    this.release = function(){
        lock.release.apply(lock, arguments);
    }
}
LockHandle.prototype.lock = function(value, callback){
    var self = this;
    this.__lock__.redis.set(this.__lock__.key, value, function(err){
        if (err) {return self.__lock__.release();}
        callback();
    });
}

function Lock(key, redis){
    this.key = key;
    this.redis = redis;
    this.locked = false;
    this.handle = new LockHandle(this);
}

Lock.prototype.acquire = function(acquired_callback, busy_callback){
    var self = this;
    self.redis.get(this.key, function(err, current_build_id){
        logger.handleException("redis.get", err);
        logger.debug(["redis.get('"+settings.REDIS_KEYS.current_build_id+"')", arguments]);

        /* if not building, let's quit and wait for the next interval */
        if (current_build_id) {
            return Build.fetch_by_id(current_build_id, busy_callback || function(err, build) {
                logger.debug('there is someone using the lock already');
            });
        }
        return acquired_callback(self.handle);
    });
}

Lock.prototype.release = function(callback){
    var self = this;
    this.redis.del(this.key, function(err, num){
        logger.handleException("redis.del(" + self.key + ")", err);
        if (err || (parseInt(num) < 1)) {return;}
        callback && callback(new Date());
    });
}

exports.Lock = Lock;
exports.LockHandle = LockHandle;
exports.logger = logger;