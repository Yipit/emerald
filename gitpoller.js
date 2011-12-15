var logger = new (require('./logger').Logger)("[GITPOLLER]".green.bold);
var settings = require('./settings');

exports.entities = require('./models');

function GitPoller(redis) {
    this.interval = settings.GIT_POLL_INTERVAL;
    this.redis = redis;
    this.loop = null;
    this.lock = new PollerLock(settings.REDIS_KEYS.current_build, redis);
    this.lifecycle = new Lifecycle(settings.REDIS_KEYS.build_queue, this.lock);
}
GitPoller.prototype.stop = function(){
    /* stopping the interval */
    this.loop && clearInterval(this.loop);
    this.lock.release(function(){
        this.redis.publish("emerald:GitPoller:stop");
    });
}

GitPoller.prototype.start = function(){
    var self = this;

    var seconds = (parseFloat(settings.GIT_POLL_INTERVAL) / 1000);

    logger.info(["running with an interval of", seconds, seconds == 1 ? "second" : "seconds"]);

    /* lets start the loop and save the handler for later*/
    self.loop = setInterval(function(){
        /* see if there is a build runnning already */
        console.log("             --------------------------------------------------------------------------------".white.bold);
        self.lifecycle.consume_build_queue(function(instruction_id_to_get, handle) {
            self.lifecycle.create_build_from_instruction(instruction_id_to_get, handle, function(instruction_to_run, current_build, handle){
                /* no errors so far, let's remove it from the queue and build */
                self.redis.zrem(settings.REDIS_KEYS.build_queue, instruction_id_to_get, function(err){
                    logger.handleException("redis.zrem", err);
                    instruction_to_run.run(current_build, self.lock);
                });
            });
        });
    }, self.interval);
}

function PollerLock(key, redis){
    this.key = key;
    this.redis = redis;
    this.locked = false;
    this.handle = new LockHandle(this);
}

PollerLock.prototype.acquire = function(callback){
    var self = this;
    this.redis.get(this.key, function(err, current_build){
        logger.handleException("redis.get", err);
        logger.debug(["redis.get('"+settings.REDIS_KEYS.current_build+"')", arguments]);

        /* if not building, let's quit and wait for the next interval */
        if (current_build) {
            logger.info("already building:", current_build);
            return;
        }
        return callback(self.handle);
    });
}

PollerLock.prototype.release = function(callback){
    var self = this;
    this.redis.del(this.key, function(err, num){
        logger.handleException("redis.del(" + self.key + ")", err);
        if (err || (parseInt(num) < 1)) {return;}
        callback && callback(new Date());
    });
}
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

function Lifecycle (key_for_build_queue, lock) {
    this.lock = lock;
    this.key_for_build_queue = key_for_build_queue;
}

Lifecycle.prototype.consume_build_queue = function(callback){
    var self = this;
    self.lock.acquire(function(handle){
        self.lock.redis.zrange(self.key_for_build_queue, 0, 1, function(err, items) {
            if (err || items.length < 1) {
                logger.info("there are no builds queued");
                return handle.release();
            }

            logger.info("consuming the build queue");
            return callback(items.first, handle);
        });
    });
}
Lifecycle.prototype.create_build_from_instruction = function(instruction_id_to_get, handle, callback) {
    var self = this;
    exports.entities.BuildInstruction.find_by_id(instruction_id_to_get, function(err, instruction) {
        if (err) {return handle.release();}
        exports.entities.Build.create({error: "", output: ""}, function(err, current_build_key, current_build) {
            if (err) {return handle.release();}
            handle.lock(current_build.__id__, function() {
                callback(instruction, current_build, handle);
            });
        });
    });
}

exports.logger = logger;
exports.GitPoller = GitPoller;
exports.LockHandle = LockHandle;
exports.PollerLock = PollerLock;
exports.Lifecycle = Lifecycle;
exports.use = function (redis) {
    return new exports.GitPoller(redis).start();
}

