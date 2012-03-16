var logger = new (require('../logger').Logger)("[ ORCHESTRATOR ]".red.bold);

module.exports.make = function(io) {
    var subscribe = require('redis').createClient();
    subscribe.setMaxListeners(1000);
    subscribe.subscribe("BuildInstruction created");
    subscribe.subscribe("BuildInstruction enqueued");
    subscribe.subscribe("BuildInstruction deleted");

    subscribe.subscribe("Repository started fetching");
    subscribe.subscribe("Repository finished fetching");
    subscribe.subscribe("Repository being fetched");

    subscribe.subscribe("Repository started updating");
    subscribe.subscribe("Repository finished updating");

    subscribe.subscribe("Build started");
    subscribe.subscribe("Build finished");
    subscribe.subscribe("Build aborted");
    subscribe.subscribe("Build stdout");
    subscribe.subscribe("Build stderr");
    subscribe.subscribe("Build output");
    subscribe.subscribe("Build running");

    subscribe.subscribe("General error");

    io.sockets.on("connection", function(socket) {
        subscribe.on("message", function(channel, message) {
            var parsed;
            try {
                parsed = JSON.parse(message);
            } catch (e) {
                parsed = message;
            }
            socket.emit(channel, parsed);
            logger.debug(channel, message);
        });
    });
};
