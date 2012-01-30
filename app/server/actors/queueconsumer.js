var async = require('async');
var logger = new (require('../logger').Logger)("[QUEUE CONSUMER]".blue.bold);

exports.entities = require('../models');
var Lock = require('../lock').Lock;

function QueueConsumer(redis) {
    this.interval = settings.GIT_POLL_INTERVAL;
    this.redis = redis;
    this.loop = null;
    this.lock = new Lock(settings.REDIS_KEYS.current_build, redis);
    this.key_for_build_queue = settings.REDIS_KEYS.build_queue;
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
        async.waterfall([
            function acquire_lock(callback) {
                logger.debug("attempting to acquire the lock");
                self.lock.acquire(callback);
            },
            function consume_build_queue(handle, callback){
                self.redis.zrange(self.key_for_build_queue, 0, 1, function(err, items) {
                    if (!err && items.length < 1) {
                        var err = new Error('the build queue is empty');
                        return callback(err, handle);
                    }
                    logger.info("consuming the build queue: found an item to build");
                    return callback(null, handle, items[0]);
                });
            },
            function fetch_build_from_instruction(handle, id, callback) {
                exports.entities.BuildInstruction.fetch_by_id(id, function(err, instruction){
                    callback(err, handle, instruction);
                });
            },
            function remove_instruction_from_queue(handle, instruction, callback) {
                self.redis.zrem(self.key_for_build_queue, instruction.__id__, function(err){
                    return callback(err, handle, instruction);
                });
            }
        ], function(err, handle, instruction){
            if (err) {
                logger.handleException(err);
                if (!handle){
                    return;
                }
                return handle.release(function(err){
                    if (err) {
                        logger.warning("could not release the lock !");
                        logger.handleException(err);
                    }
                });
            }
            instruction.run(handle);
        });
    }, self.interval);
}

exports.logger = logger;
exports.QueueConsumer = QueueConsumer;
exports.use = function (redis) {
    return new exports.QueueConsumer(redis).start();
}

