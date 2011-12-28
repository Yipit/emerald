var logger = new (require('./logger').Logger)("[ ORCHESTRATOR ]".red.bold);

module.exports.use = function(redis, socket) {
    logger.info("I'm awake");
    const subscribe = require('redis').createClient();
    subscribe.subscribe("BuildInstruction enqueued");
    subscribe.subscribe("Repository being fetched");
    subscribe.subscribe("Repository finished fetching");
    subscribe.subscribe("Build started");
    subscribe.subscribe("Build finished");

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
            logger.success("The BuildInstruction #"+parsed.id+"was successfully enqueued");
                break;
        }
    });

    socket.on('disconnect', function() {
        subscribe.quit();
    });
}