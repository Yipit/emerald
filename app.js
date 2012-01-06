(function(){
    var logger = new (require('./logger').Logger)("[MAIN]".white.bold);

    /* importing dependencies */
    var _ = require('underscore')._,
    async = require('async'),
    swig = require('swig'),
    settings = require('./settings'),

    boot = require('./boot'),

    express = require('express'),

    /* importing some emerald actors */
    queueconsumer = require('./queueconsumer'),
    websockets = require('./websockets'),
    controllers = require('./controllers');

    /* preparing redis */
    RedisStore = require('connect-redis')(express),
    Redis = require('redis'),
    redis = Redis.createClient();

    /* preparing the http server and the socket.io */
    var app = express.createServer();
    var io = require('socket.io').listen(app);

    /* configuring the express app */
    app.configure(function(){
        /*
           swig provides a django-like templates
           the code below configures espress to use swig as default templates
        */
        swig.init({
            root: settings.VIEW_PATH,
            allowErrors: true
        });
        app.set('views', settings.VIEW_PATH);
        app.register('.html', swig);

        app.set('views', settings.VIEW_PATH);
        app.set('view engine', 'html');
        app.set('view options', { layout: false });

        /* very basic HTTP stuff */
        app.use(express.bodyParser());
        app.use(express.methodOverride());
        app.use(express.cookieParser());

        /* and session */
        app.use(express.session({
            secret: 'ac39aeb9ab288f96fe51ef594bfca20262fa184e',
            store: new RedisStore({ client: redis })
        }));

        /* using http://lesscss.org for stylesheets */
        app.use(express.compiler({src: settings.LOCAL_FILE('public'), enable: ['less'] }));

        app.use(app.router);
        app.use(express.static(settings.ASSETS_PATH));
        app.use(express.static(settings.CLIENT_PATH));
    });

    app.configure('development', function(){
        app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
    });

    app.configure('production', function(){
        app.use(express.errorHandler());
    });

    /* start up the emerald actors */

    boot.now(app, io, redis, settings, function(cwd){
        app.listen(parseInt(process.env.PORT || 3000));
        queueconsumer.use(redis);
        websockets.work_on(redis, io);
        controllers.map(app, redis);
    });


    /* handling CONTROL-C */

    process.on("SIGINT", function(signal){
        var unicode_heart = String.fromCharCode(0x2764).red;

        /* handling control-C */
        process.stdout.write('\r  \n');
        console.log(['EMERALD'.green, 'caught a'.white, 'CONTROL-C'.red.bold, unicode_heart].join(' ').green.bold);

        process.stdout.write('Cleaning up redis... ');
        async.waterfall(
            [
                function looking_for_emerald_stuff_in_redis(callback){
                    /* matching keys */
                    redis.keys("emerald:*", callback);
                },
                function clean_whatever_requires_to (keys, callback){
                    /* cleaning up queue, cache, etc. */
                    async.forEach(keys, function(key, callback){
                        redis.del(key, callback);
                    }, callback);
                }
            ], function(err) {
                if (err) {
                    process.stdout.write('FAILED\n\n'.red.bold);
                    console.log(['Exception:', err.toString()].join(' ').red.bold);
                    console.log(err.stack.toString().red.bold);
                } else {
                    process.stdout.write('OK\n\n'.green.bold);
                }
                process.reallyExit(1);
            });

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
                    logger.warning(err.stack.toString().yellow.bold);
                } else {
                    logger.info("redis cleansed successfully".white.bold);
                }

                logger.fail(['Original exception: ', original_exception.toString(), ''].join('"').red.bold);
                console.log((original_exception.stack + "").yellow.bold);
                process.reallyExit(err && 1 || 0);
            });
    });

})();