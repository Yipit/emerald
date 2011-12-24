(function(){
    var _ = require('underscore')._,
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
})();