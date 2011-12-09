var logger = new (require('./logger').Logger)("[GIT POLLER]".green.bold);
var settings = require('./settings');
var entity = require('./models');

function GitPoller(redis, pubsub) {
    this.interval = settings.GIT_POLL_INTERVAL;
    this.redis = redis;
    this.pubsub = pubsub;
    this.lock = new BuildLock({redis:redis});
    this.loop = null;
}
GitPoller.prototype.stop = function(){
    /* stopping the interval */
    this.loop && clearInterval(this.loop);
    this.pubsub.publish("emerald:GitPoller:stop");
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
    this.loop = setInterval(function(){
        /* see if there is a build runnning already */
        console.log("             --------------------------------------------------------------------------------".white.bold);
        self.redis.get(settings.REDIS_KEYS.current_build, function(err, current_build){
            logger.handleException("redis.get", err);
            logger.debug(["redis.get('"+settings.REDIS_KEYS.current_build+"')", arguments]);

            /* if not building, let's quit and wait for the next interval */
            if (current_build) {
                logger.info("already building:", current_build);
                return;
            }
            logger.info("no builds running, checking the queue");
            /* since it is not building anything, lets get the first build to be runned */
            self.redis.zrange(settings.REDIS_KEYS.build_queue, 0, 1, function(err, items) {
                logger.handleException("redis.zrange", err);
                logger.debug(["redis.zrange('"+settings.REDIS_KEYS.build_queue+"', 0, 1)", arguments]);
                /* if there is nothing to run, let's quit and wait for the next interval */
                if (items.length === 0) {
                    logger.info("nothing to build so far");
                    return;
                }
                var instruction_id_to_get = items.first;
                entity.BuildInstruction.find_by_id(instruction_id_to_get, function(err, instruction_to_run) {
                    if (err) {
                        logger.handleException("BuildInstruction.find_by_id", err);
                        logger.fail(['could not find BuildInstruction with id', instruction_id_to_get, err.toString()]);
                        return;
                    }

                    entity.Build.create({output: "", error: ""}, function(err, key, current_build) {
                        logger.handleException("Build.create", err);
                        self.redis.set(settings.REDIS_KEYS.current_build, current_build.__id__, function(err) {
                            logger.handleException("redis.set", err);
                            if (err) {
                                logger.fail(['could not set the key', settings.REDIS_KEYS.current_build, 'to true (redis)', err.toString()]);
                                return redis.del(settings.REDIS_KEYS.current_build);
                            }

                            /* no errors so far, let's remove it from the queue and build */
                            self.redis.zrem(settings.REDIS_KEYS.build_queue, instruction_id_to_get, function(err){
                                logger.handleException("redis.zrem", err);
                                instruction_to_run.run(current_build);
                            });
                        });
                    });
                });
            });

        });
    }, self.interval);
}

function BuildLock(options){}

exports.use = function (redis) {
    return new GitPoller(redis).start();
}