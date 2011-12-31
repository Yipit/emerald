(function(){
    var logger = new (require('./logger').Logger)("[MAIN]".white.bold);

    var _ = require('underscore')._,
    async = require('async'),
    settings = require('./settings'),

    boot = require('./boot'),

    express = require('express'),

    queueconsumer = require('./queueconsumer'),
    websockets = require('./websockets'),
    controllers = require('./controllers');

    RedisStore = require('connect-redis')(express),
    Redis = require('redis'),
    redis = Redis.createClient(),
    middleware = require('./middleware');

    var app = express.createServer();
    var io = require('socket.io').listen(app);

    app.configure(function(){
        app.set('views', __dirname + '/views');
        app.set('view engine', 'jade');
        app.use(express.bodyParser());
        app.use(express.methodOverride());
        app.use(express.cookieParser());
        app.use(express.session({
            secret: 'ac39aeb9ab288f96fe51ef594bfca20262fa184e',
            store: new RedisStore({ client: redis })
        }));

        app.use(express.compiler({src: settings.LOCAL_FILE('public'), enable: ['less'] }));
        app.use(middleware.authentication);

        app.use(app.router);
        app.use(express.static(settings.LOCAL_FILE('/public')));
    });

    app.configure('development', function(){
        app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
    });

    app.configure('production', function(){
        app.use(express.errorHandler());
    });

    boot.now(app, io, redis, settings, function(cwd){
        app.listen(parseInt(process.env.PORT || 3000));
        queueconsumer.use(redis);
        websockets.work_on(redis, io);
        controllers.map(app, redis);
    });


    process.on("SIGINT", function(signal){
        var unicode_heart = String.fromCharCode(0x2764).red.bold;
        var unicode_scissor = String.fromCharCode(0x272D).yellow.bold;
        var unicode_emerald = String.fromCharCode(0x25C8).green;
        /* handling control-C */
        process.stdout.write('\r  \n');
        console.log(unicode_emerald, "EMERALD".green.bold, unicode_emerald, "says: farewell!".white.bold);
        console.log([unicode_heart, 'And thanks for the '.red+'CONTROL-C'.yellow.bold, unicode_heart].join(' ').green.bold);
        process.stdout.write('\n\n');
        process.reallyExit(1);
    });

    process.on('uncaughtException', function (err) {
        logger.fail("EMERALD has quit due an internal crash".red.bold);
        logger.fail("it's now executing some procedures in order to clean up the build environment".red.bold);
        logger.fail("I'm gonna show you the traceback in a second.".red.bold);

        var original_exception = err;
        async.waterfall([
            function looking_for_emerald_stuff_in_redis(callback){
                /* matching keys */
                redis.keys("emerald:*", callback);
            },
            function clean_whatever_requires_to (keys, callback){
                /* cleaning up queue, cache, etc. */
                logger.info("cleansing out redis stuff...".white.bold);
                async.forEach(keys, function(key, callback){
                    redis.del(key, callback);
                }, callback);
            }], function(err) {
                if (err) {
                    logger.warning(['There was also a failure while cleaning up redis...', err.toString() + ''].join('"').yellow.bold);
                    logger.warning((err.stack + "").yellow.bold)
                } else {
                    logger.info("redis cleansed successfully".white.bold);
                }

                logger.fail(['Original exception: ', original_exception.toString(), ''].join('"').red.bold);
                console.log((original_exception.stack + "").yellow.bold);
                process.reallyExit(err && 1 || 0);
            });
    });

})();