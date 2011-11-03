(function(){
    var fs         = require("fs")
    ,util          = require("util")
    ,express       = require('express')
    ,child_process = require("child_process")
    ;

    var app = module.exports = express.createServer(),
    io = require('socket.io').listen(app);

    /* Configuration */

    app.configure(function(){
        app.set('views', __dirname + '/views');
        app.set('view engine', 'jade');
        app.use(express.bodyParser());
        app.use(express.methodOverride());
        app.use(express.cookieParser());
        app.use(express.session({ secret: 'your secret here' }));
        app.use(express.compiler({ src: __dirname + '/public', enable: ['less'] }));
        app.use(function(request, response, next){console.log(request.url); return next();});
        app.use(app.router);
        app.use(express.static(__dirname + '/public'));

    });

    app.configure('development', function(){
        app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
    });

    app.configure('production', function(){
        app.use(express.errorHandler());
    });

    /* Routes */

    app.get('/', function(req, res){
        res.render('index', {
            title: 'Emerald - Continuous Integration'
        });
    });
    app.all('/project', function(req, res){
        res.render('build-new', {
            title: 'Emerald - Continuous Integration'
        });
    });

    io.sockets.on('connection', function (socket) {
        socket.on('please:create:build', function (data) {
            var filename = data.name.split(/\W+/).join("-") + '.sh';
            fs.writeFile(filename, "#!/bin/bash\n" + data.commands, function (err) {
                if (err) {throw err;}

                fs.chmod(filename, '755', function(err){
                    if (err) {throw err;}


                    var cmd = child_process.spawn('bash', [filename]);
                    cmd.stdout.on('data', function (data) {
                        var out = data.toString().replace('\n', '<br />');
                        socket.emit('stdout', out);
                    });
                    cmd.stderr.on('data', function (data) {
                        var out = data.toString().replace('\n', '<br />');
                        socket.emit('stderr', out);
                    });
                    cmd.on('exit', function (code) {
                        socket.emit('finished', {
                            'code':code + "",
                            'pid': cmd.pid + ""
                        });
                    });
                });
            });
        });
    });
    app.listen(3000);
})();
