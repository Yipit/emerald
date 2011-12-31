var entity = require("./models");
var settings = require('./settings');

var logger = new (require('./logger').Logger)("[WEBSOCKET]".blue.bold);

exports.work_on = function(redis, io) {
    io.configure(function(){
        io.set('logger', logger);
    });

    io.sockets.on('connection', function (socket) {
        socket.emit('connected');

        require('./orchestrator').use(redis, socket);

        ['BuildInstruction', 'User'].forEach(function(ModelName){
            socket.on('delete ' + ModelName, function (data) {
                entity[ModelName].find_by_id(parseInt(data.id), function(err, instance){
                    logger.handleException("entity." + ModelName + ".find_by_id", err);
                    instance.delete(function(err){
                        logger.handleException("(new " + ModelName + ")({__id__:" + data.id + "}).delete():", err);
                        logger.info([ModelName, "#" + data.id, "deleted"]);
                        socket.emit(ModelName + ' deleted', {id: data.id});
                    });
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
