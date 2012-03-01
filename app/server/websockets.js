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
var async = require('async');
var entity = require('./models');

var logger = new (require('./logger').Logger)("[WEBSOCKET]".magenta.bold);
exports.logger = logger;
exports.work_on = function(redis, io) {
    io.configure(function () {
        io.set("transports", ["xhr-polling"]);
        io.set("polling duration", 10);
    });
    io.sockets.on('connection', function (socket) {
        socket.emit('connected');

        socket.on('abort Build', function (data) {
            entity.Build.fetch_by_id(data.id, function(err, build){
                if (err) {
                    logger.fail(['could not abort the build #' + data.id, 'due', err.toString()]);
                    logger.fail(err.stack.toString());
                    return;
                }
                logger.info('someone issued a manual abort onto build #' + data.id);
                build.abort();
            });
        });
        socket.on('delete BuildInstruction', function (data) {
            function report_problem(error) {
                return redis.publish('General error', JSON.stringify({
                    title: 'Could not delete the instruction #' + data.id,
                    text: error.toString()
                }));
            }
            entity.BuildInstruction.find_by_id(data.id, function(err, instruction){
                if (err){return report_problem(err);}
                instruction.erase(function(err){
                    if (err) {return report_problem(err);}
                    redis.publish('BuildInstruction deleted', JSON.stringify({
                        instruction: instruction.toBackbone()
                    }));
                });

            });
        });
        socket.on('run BuildInstruction', function (data) {
            var now = new Date();

            async.waterfall([
                function find_by_id(callback){
                    entity.BuildInstruction.find_by_id(data.id, callback);
                },
                function fetch_builds(instruction, callback){
                    entity.BuildInstruction.with_builds_from_data(instruction.__data__, callback);
                },
                function add_build_to_queue_raising_score(instruction, callback){
                    redis.zincrby(settings.REDIS_KEYS.build_queue, 1, data.id, function(){
                        callback(null, instruction);
                    });
                },
                function notify_redis_about_it(instruction, callback) {
                    redis.publish("BuildInstruction enqueued", JSON.stringify(instruction.toBackbone()));
                    callback(null, instruction);
                }
            ], function(err, instruction) {
                if (err) {
                    logger.handleException(err);
                    logger.fail('EMERALD has failed to run the build instruction:' + err.toString().red.bold);
                } else {
                    logger.success("enqueuing instruction #" + instruction.__id__);
                }
            });
        });
    });
};
