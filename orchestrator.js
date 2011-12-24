var logger = new (require('./logger').Logger)("[ ORCHESTRATOR ] ".red.bold);

module.exports.use = function(redis, socket) {
    logger.info("I'm awake");
    const subscribe = require('redis').createClient();
    subscribe.subscribe("BuildInstruction enqueued")

    subscribe.on("message", function(channel, message) {
        var parsed;
        try {
            parsed = JSON.parse(message);
        } catch (e) {
            parsed = message;
        }
        socket.emit(channel, parsed);
        switch (channel) {
            case "BuildInstruction enqueued":
            logger.success("A the BuildInstruction #"+parsed.id+"was successfully enqueued");
                break;
        }
    });

    socket.on('disconnect', function() {
        subscribe.quit();
    });
}
