var models = require('./models');

exports.setup = function(app, io){
    var entity = models.prepare(io, app);

    app.get('/', function(req, res){
        res.show('index');
    });
    app.all('/instruction/new', function(req, res){
        res.show('build-new');
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
}
