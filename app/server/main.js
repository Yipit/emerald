/***************************************************************************
Emerald - Continuous Integration server focused on real-time interactions
Copyright (C) <2012>  Gabriel Falcão <gabriel@yipit.com>
Copyright (C) <2012>  Yipit Inc. <coders@yipit.com>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
 ***************************************************************************/
var logger = new (require('./logger').Logger)("[MAIN]".white.bold);

/* importing dependencies */
var _ = require('underscore')._,
async = require('async'),
swig = require('swig'),

boot = require('./boot'),

express = require('express'),

/* importing some emerald actors */
queueconsumer = require('./actors/queueconsumer'),
orchestrator = require('./actors/orchestrator'),
websockets = require('./websockets'),
controllers = require('./controllers');

/* preparing redis */
RedisStore = require('connect-redis')(express),
redis = require('redis').createClient();

/* preparing the http server and the socket.io */
var app = express.createServer();

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


exports.run = function(){
    var io = require('socket.io').listen(app, {
        'log level': settings.LOG_LEVEL,
        'logger': websockets.logger
    });
    /* start up the emerald actors */
    boot.now(app, io, redis, function(cwd) {
        app.listen(parseInt(process.env.PORT || settings.EMERALD_PORT));
        queueconsumer.use(redis);
        orchestrator.make(io);
        websockets.work_on(redis, io);
        controllers.map(app, redis);
    });
}
