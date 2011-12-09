var logger = new (require('./logger').Logger)("[Redis Pub/Sub]".yellow);

module.exports.use = function(redis, io) {
    redis.subscribe("BuildInstruction enqueued", function(data){
        io.sockets.on('connection', function (socket) {
            socket.emit("BuildInstruction enqueued", JSON.parse(data));
        });
    });
}