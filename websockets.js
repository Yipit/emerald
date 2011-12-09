var entity = require("./models");
var settings = require('./settings');

var logger = new (require('./logger').Logger)("[websockets]".yellow);

exports.work_on = function(redis, io) {
    io.sockets.on('connection', function (socket) {
        socket.emit('connected');

        require('./pubsub').use(redis, socket);

        socket.on('delete BuildInstruction', function (data) {
            entity.BuildInstruction.find_by_id(parseInt(data.id), function(err, instruction){
                logger.handleException("entity.BuildInstruction.find_by_id", err);
                instruction.delete(function(){
                    socket.emit('BuildInstruction deleted', {id: instruction.__id__});
                });
            });
        });
        socket.on('delete User', function (data) {
            entity.User.find_by_id(parseInt(data.id), function(err, instruction){
                logger.handleException("entity.User.find_by_id", err);
                instruction.delete(function(){
                    socket.emit('User deleted', {id: instruction.__id__});
                });
            });
        });
        socket.on('run BuildInstruction', function (data) {
            logger.info("enqueuing instruction #" + data.id);
            redis.zincrby(settings.REDIS_KEYS.build_queue, 1, data.id, function(err){
                logger.handleException("redis.zincrby", err);

                var now = new Date();
                entity.BuildInstruction.find_by_id(parseInt(data.id), function(err, instruction) {
                    logger.handleException(err);

                    redis.publish("BuildInstruction enqueued", JSON.stringify({
                        data: instruction.__data__,
                        id: instruction.__id__,
                        at: now.toTimeString()
                    }));
                });
            });
        });
    });
}