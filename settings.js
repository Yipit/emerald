var _ = require('underscore')._;
var path = require('path');

var EMERALD_PORT = parseInt(process.env.EMERALD_PORT || 3000);
var EMERALD_HOSTNAME = process.env.EMERALD_HOSTNAME || 'localhost';
var EMERALD_DOMAIN = ('http://' + (EMERALD_HOSTNAME + (EMERALD_PORT == 80 ? "" : (":" + EMERALD_PORT))));
var EMERALD_PATH = process.env.EMERALD_PATH || path.join(process.env.HOME, '.emerald');

function LOCAL_FILE(){
    var parts = [__dirname];
    _.each(arguments, function(item){parts.push(item);});
    return path.join.apply(path, parts);
}

var CLIENT_PATH        = LOCAL_FILE('app', 'client');
var BACKBONE_VIEW_PATH = path.join(CLIENT_PATH, 'html');

var VIEW_PATH          = LOCAL_FILE('app', 'server', 'html');
var ASSETS_PATH        = LOCAL_FILE('public');
var CSS_PATH           = path.join(ASSETS_PATH, 'public');
var PID_PATH           = '/tmp/emerald.pid'
var STDOUT_PATH        = '/tmp/emerald.stdout.log'
var STDERR_PATH        = '/tmp/emerald.stderr.log'

module.exports = {
    LOG_LEVEL: 3,
    GIT_POLL_INTERVAL: 3000, /* 60.000 miliseconds = 1 second */
    SPAWN_TIMEOUT: 10,       /* Value in seconds */
    EMERALD_PORT: EMERALD_PORT,
    EMERALD_HOSTNAME: EMERALD_HOSTNAME,
    EMERALD_DOMAIN: EMERALD_DOMAIN,
    REDIS_KEYS: {
        current_build: "emerald:current-build",
        build_queue: "emerald:build-queue"
    },
    EMERALD_PATH: EMERALD_PATH,
    SANDBOX_PATH: process.env.EMERALD_SANDBOX_PATH || path.join(EMERALD_PATH, "builds"),
    ASSETS_PATH: ASSETS_PATH,
    LOCAL_FILE: LOCAL_FILE,
    VIEW_PATH: VIEW_PATH,
    CLIENT_PATH: CLIENT_PATH,
    BACKBONE_VIEW_PATH: BACKBONE_VIEW_PATH,
    SCRIPT_PATH: LOCAL_FILE('app', 'terminal', 'main.js'),
    PID_PATH: PID_PATH,
    STDOUT_PATH: STDOUT_PATH,
    STDERR_PATH: STDERR_PATH
}
