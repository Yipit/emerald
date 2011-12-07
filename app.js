(function(){
    var _ = require('underscore')._,
    controllers = require('./controllers'),
    express = require('express'),
    fs = require('fs'),
    path = require('path'),
    ansispan = require('ansispan'),
    child_process = require('child_process'),
    RedisStore = require('connect-redis')(express),
    redis = require("redis").createClient(),
    entity = require('./models');

    redis.debug_mode = true;
    var app = express.createServer();
    var io = require('socket.io').listen(app);
    function LOCAL_FILE (){
        var parts = [__dirname];
        _.each(arguments, function(item){parts.push(item);});
        return path.join.apply(path, parts);
    }
    var jade = require('jade');
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

        app.use(express.compiler({ src: LOCAL_FILE('public'), enable: ['less'] }));
        app.use(function(request, response, next) {
            fs.readFile(LOCAL_FILE('.terminal_example.txt'), function(err, raw_terminal_example) {
                entity.User.find_by_id(request.session.user_id, function(err, user) {
                    response.show = function (name, context) {
                        var c = _.extend(context || {}, {
                            title: 'Emerald - Continuous Integration',
                            request: request,
                            user: user,
                            terminal_example: ansispan(raw_terminal_example.toString())
                        });
                        response.render(name, c);
                    }
                    return next();
                });
            });
        });

        app.use(app.router);
        app.use(express.static(LOCAL_FILE('/public')));
    });

    app.configure('development', function(){
        app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
    });

    app.configure('production', function(){
        app.use(express.errorHandler());
    });

    io.configure('production', function(){
        io.enable('browser client minification');
        io.set('log level', 0);
        io.set('transports', ['xhr-polling']);
    });

    io.configure('development', function(){
        io.set('log level', 0);
    });

    app.listen(3000);
    controllers.start(app, io, redis);
})();