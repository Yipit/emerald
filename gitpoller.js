var logger = new (require('./logger').Logger)("[GIT POLLER]".green.bold);
var settings = require('./settings');
var entity = require('./models');

function GitPoller(redis, pubsub) {
    this.interval = settings.GIT_POLL_INTERVAL;
    this.redis = redis;
    this.pubsub = pubsub;
    this.lock = new BuildLock({redis:redis});
    this.loop = null;
    this.lock = new BuildLock(redis);
}
GitPoller.prototype.stop = function(){
    /* stopping the interval */
    this.loop && clearInterval(this.loop);
    this.lock.release(function(){
        this.pubsub.publish("emerald:GitPoller:stop");
    });
}
var loglevel = {
    DEBUG: 4,
    SUCCESS: 3,
    INFO: 2,
    FAIL: 1,
    CRITICAL: 0
}

GitPoller.prototype.start = function(){
    var self = this;

    var seconds = (parseFloat(settings.GIT_POLL_INTERVAL) / 1000);

    logger.info(["running with an interval of", seconds, seconds == 1 ? "second" : "seconds"]);

    /* lets start the loop and save the handler for later*/
    self.loop = setInterval(function(){
        /* see if there is a build runnning already */
        console.log("             --------------------------------------------------------------------------------".white.bold);
        self.lock.acquire(function(current_build){
            logger.info("no builds running, checking the queue");
            /* since it is not building anything, lets get the first build to be runned */
            self.redis.zrange(settings.REDIS_KEYS.build_queue, 0, 1, function(err, items) {
                logger.handleException("redis.zrange", err);
                logger.debug(["redis.zrange('"+settings.REDIS_KEYS.build_queue+"', 0, 1)", arguments]);
                /* if there is nothing to run, let's quit and wait for the next interval */
                if (items.length === 0) {
                    logger.info("nothing to build so far");
                    return self.lock.release();
                }
                var instruction_id_to_get = items.first;
                entity.BuildInstruction.find_by_id(instruction_id_to_get, function(err, instruction_to_run) {
                    if (err) {
                        logger.handleException("BuildInstruction.find_by_id", err);
                        logger.fail(['could not find BuildInstruction with id', instruction_id_to_get, err.toString()]);
                        return self.lock.release();
                    }

                    entity.Build.create({output: "", error: ""}, function(err, key, current_build) {
                        logger.handleException("Build.create", err);
                        self.redis.set(settings.REDIS_KEYS.current_build, current_build.__id__, function(err) {
                            logger.handleException("redis.set", err);
                            if (err) {
                                logger.fail(['could not set the key', settings.REDIS_KEYS.current_build, 'to true (redis)', err.toString()]);
                                return self.lock.release();
                            }

                            /* no errors so far, let's remove it from the queue and build */
                            self.redis.zrem(settings.REDIS_KEYS.build_queue, instruction_id_to_get, function(err){
                                logger.handleException("redis.zrem", err);
                                instruction_to_run.run(current_build, self.lock);
                            });
                        });
                    });
                });
            });

        });
    }, self.interval);
}

function BuildLock(redis){
    this.locked = false;
    this.redis = redis;
}
BuildLock.prototype.acquire = function(callback){
    this.redis.get(settings.REDIS_KEYS.current_build, function(err, current_build){
        logger.handleException("redis.get", err);
        logger.debug(["redis.get('"+settings.REDIS_KEYS.current_build+"')", arguments]);

        /* if not building, let's quit and wait for the next interval */
        if (current_build) {
            logger.info("already building:", current_build);
            return;
        }
        return callback(current_build);
    });
}

BuildLock.prototype.release = function(callback){
    this.redis.del(settings.REDIS_KEYS.current_build, function(err){
        logger.handleException("redis.del(" + settings.REDIS_KEYS.current_build + ")", err);
        callback && callback(new Date());
    });
}

exports.use = function (redis) {
    return new GitPoller(redis).start();
}