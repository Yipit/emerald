/* Emerald - Continuous Integration server focused on real-time interactions
 *
 *   Copyright (C) 2012  Yipit Inc. <coders@yipit.com>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

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
    if (this.loop) {
        clearInterval(this.loop);
    }
    this.lock.release(function(){
        this.redis.publish("emerald:QueueConsumer:stop");
    });
};

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
                        logger.debug("the build queue is empty");
                    } else {
                        logger.info("consuming the build queue: found an item to build");
                    }

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
                var build_not_found = new RegExp('.*BuildInstruction.*id undefined');

                if (build_not_found.test(err.message)) {
                    return; /* ignore errors for instruction not found*/
                }

                logger.handleException(err, "queue consumer loop");
                if (handle){
                    return handle.release(function(err){
                        if (err) {
                            logger.warning("could not release the lock !");
                            logger.handleException(err);
                        }
                    });
                }
            }

            self.redis.save(function(){
                logger.info("asking redis to dump its in-memory data to the disk");
                instruction.run(handle);
            });
        });
    }, self.interval);
};

exports.logger = logger;
exports.QueueConsumer = QueueConsumer;
exports.use = function (redis) {
    return new exports.QueueConsumer(redis).start();
};

