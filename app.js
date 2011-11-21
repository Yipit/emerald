(function(){
    var _ = require('underscore')._,
    controllers = require('./controllers'),
    express = require('express');

    var app = express.createServer();
    var io = require('socket.io').listen(app);

    var jade = require('jade');
    app.configure(function(){
        app.set('views', __dirname + '/views');
        app.set('view engine', 'jade');
        app.use(express.bodyParser());
        app.use(express.methodOverride());
        app.use(express.cookieParser());
        app.use(express.session({ secret: process.env['HOME'] + process.env['NODE_PATH'] }));
        app.use(express.compiler({ src: __dirname + '/public', enable: ['less'] }));
        app.use(function(request, response, next){
            response.show = function (name, context){
                var c = _.extend(context || {}, {
                    title: 'Emerald - Continuous Integration'
                });
                response.render(name, c);
            }
            return next();
        });
        app.use(app.router);
        app.use(express.static(__dirname + '/public'));
    });

    app.configure('development', function(){
        app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
    });

    app.configure('production', function(){
        app.use(express.errorHandler());
    });


    app.listen(3000);

    controllers.start(app, io);
})();