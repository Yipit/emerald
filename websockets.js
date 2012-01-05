var async = require('async');
var entity = require("./models");
var settings = require('./settings');

var logger = new (require('./logger').Logger)("[WEBSOCKET]".magenta.bold);

exports.work_on = function(redis, io) {
    io.configure(function(){
        io.set('logger', logger);
    });

    io.sockets.on('connection', function (socket) {
        socket.emit('connected');

        require('./orchestrator').use(redis, socket);
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
        socket.on('run BuildInstruction', function (data) {
            var now = new Date();

            var instruction_id = parseInt(data.id);

            async.waterfall([
                function find_by_id(callback){
                    entity.BuildInstruction.find_by_id(instruction_id, callback);
                },
                function fetch_builds(instruction, callback){
                    entity.BuildInstruction.with_builds_from_data(instruction.__data__, callback);
                },
                function add_build_to_queue_raising_score(instruction, callback){
                    redis.zincrby(settings.REDIS_KEYS.build_queue, 1, instruction_id, function(){
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
}
