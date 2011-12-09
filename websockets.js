var entity = require("./models");
var settings = require('./settings');

var logger = new (require('./logger').Logger)("[websockets]".yellow);

exports.work_on = function(redis, io) {
    io.sockets.on('connection', function (socket) {
        socket.emit('connected');

        socket.on('delete BuildInstruction', function (data) {
            entity.BuildInstruction.find_by_id(parseInt(data.id), function(err, instruction){
                instruction.delete(function(){
                    socket.emit('BuildInstruction deleted', {id: instruction.__id__});
                });
            });
        });
        socket.on('delete User', function (data) {
            entity.User.find_by_id(parseInt(data.id), function(err, instruction){
                instruction.delete(function(){
                    socket.emit('User deleted', {id: instruction.__id__});
                });
            });
        });
        socket.on('run BuildInstruction', function (data) {
            logger.debug("enqueuing instruction #" + data.id);
            redis.zadd(REDIS_KEYS.build_queue, data.id, function(){
                logger.debug(["redis.zadd(REDIS_KEYS.build_queue, data.id):", arguments]);
                var now = new Date();
                entity.BuildInstruction.find_by_id(parseInt(data.id), function(err, instruction) {
                    logger.debug(["entity.BuildInstruction.find_by_id(parseInt(data.id), function(err, instruction)):", arguments]);

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