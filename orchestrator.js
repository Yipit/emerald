var logger = new (require('./logger').Logger)("[ ORCHESTRATOR ]".red.bold);

module.exports.use = function(redis, socket) {
    const subscribe = require('redis').createClient();
    subscribe.subscribe("BuildInstruction enqueued");

    subscribe.subscribe("Repository started fetching");
    subscribe.subscribe("Repository finished fetching");
    subscribe.subscribe("Repository being fetched");

    subscribe.subscribe("Build started");
    subscribe.subscribe("Build finished");
    subscribe.subscribe("Build aborted");
    subscribe.subscribe("Build output");

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
            logger.info("The BuildInstruction #"+parsed.id+" was successfully enqueued");
                break;
            case "Repository started fetching":
            logger.info("The Build #"+parsed.build.__id__+" started fetching changes from the repository");
                break;
            case "Repository finished fetched":
            logger.info("The Build #"+parsed.build.__id__+" finished fetching changes from the repository");
                break;
            case "Build started":
            logger.info("The Build #"+parsed.build.__id__+" has started running");
                break;
            case "Build finished":
            logger.info("The Build #"+parsed.build.__id__+" has finished running");
                break;
            case "Build aborted":
            logger.info("The Build #"+parsed.build.__id__+" was aborted");
                break;

        }
    });

    socket.on('disconnect', function() {
        subscribe.quit();
    });
}
