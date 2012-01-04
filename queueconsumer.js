var logger = new (require('./logger').Logger)("[QUEUE CONSUMER]".blue.bold);
var settings = require('./settings');

exports.entities = require('./models');

function QueueConsumer(redis) {
    this.interval = settings.GIT_POLL_INTERVAL;
    this.redis = redis;
    this.loop = null;
    this.lock = new PollerLock(settings.REDIS_KEYS.current_build, redis);
    this.lifecycle = new Lifecycle(settings.REDIS_KEYS.build_queue, this.lock);
}
QueueConsumer.prototype.stop = function(){
    /* stopping the interval */
    this.loop && clearInterval(this.loop);
    this.lock.release(function(){
        this.redis.publish("emerald:QueueConsumer:stop");
    });
}

QueueConsumer.prototype.start = function(){
    var self = this;

    var seconds = (parseFloat(settings.GIT_POLL_INTERVAL) / 1000);

    logger.success(["running with an interval of", seconds, seconds == 1 ? "second" : "seconds"]);

    /* lets start the loop and save the handler for later*/
    self.loop = setInterval(function(){
        /* see if there is a build runnning already */
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
            logger.debug("already building:", JSON.stringify(current_build));
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
                logger.debug("there are no builds queued");
                return handle.release();
            }

            logger.info("consuming the build queue: found an item to build");
            return callback(items.first, handle);
        });
    });
}
Lifecycle.prototype.create_build_from_instruction = function(instruction_id_to_get, handle, callback) {
    var self = this;
    exports.entities.BuildInstruction.fetch_by_id(instruction_id_to_get, function(err, instruction) {
        if (err) {return handle.release();}
        var now = new Date();
        exports.entities.Build.create({
            error: "",
            output: "",
            stage: exports.entities.STAGES_BY_NAME.BEGINNING,
            build_started_at: new Date()
        }, function(err, current_build_key, current_build) {
            if (err) {return handle.release();}
            handle.lock(current_build.__id__, function() {
                callback(instruction, current_build, handle);
            });
        });
    });
}
Lifecycle.prototype.run_a_instruction = function(instruction, build, handle, callback) {
    var self = this;
    self.lock.redis.zrem(instruction.__id__, function(err){
        if (err) {return handle.release();}
        instruction.run(build, handle);
    });
}

exports.logger = logger;
exports.QueueConsumer = QueueConsumer;
exports.LockHandle = LockHandle;
exports.PollerLock = PollerLock;
exports.Lifecycle = Lifecycle;
exports.use = function (redis) {
    return new exports.QueueConsumer(redis).start();
}

