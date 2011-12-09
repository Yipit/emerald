var _ = require('underscore')._;
var path = require('path');

EMERALD_PORT = parseInt(process.env.EMERALD_PORT || 3000),
EMERALD_HOSTNAME = process.env.EMERALD_HOSTNAME || 'localhost',
EMERALD_DOMAIN = ('http://' + EMERALD_HOSTNAME + (EMERALD_PORT == 80 ? "" : (":" + EMERALD_PORT))).trim("/"),

module.exports = {
    LOG_LEVEL: 5,
    GIT_POLL_INTERVAL: 5000, /* 60.000 miliseconds = 1 second */
    EMERALD_PORT: EMERALD_PORT,
    EMERALD_HOSTNAME: EMERALD_HOSTNAME,
    EMERALD_DOMAIN: EMERALD_DOMAIN,
    REDIS_KEYS: {
        current_build: "emerald:current-build",
        build_queue: "emerald:build-queue"
    },
    LOCAL_FILE: function(){
        var parts = [__dirname];
        _.each(arguments, function(item){parts.push(item);});
        return path.join.apply(path, parts);
    }
}