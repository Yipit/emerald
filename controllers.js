var models = require('./models');

exports.start = function(app, io){
    var entity = models.prepare(io, app);

    app.get('/', function(request, response){
        response.show('index');
    });

    app.all('/instructions', function(request, response){
        switch (request.method) {
            case "GET":
                entity.BuildInstruction.all(function(err, instructions){
                    response.show('manage-instructions', {instructions: instructions, has_instructions: instructions.length > 0});
                });
            break;
            case "POST":
                var naive = new entity.BuildInstruction({
                    name: request.param('name'),
                    description: request.param('description'),
                    repository_address: request.param('repository_address'),
                    build_command: request.param('build_command')
                });
                naive.save(function(err, key, instruction) {
                    response.redirect('/instruction/' + instruction.__id__)
                });
            break;
            default:
                response.send('missing request.method', 500);
            break;
        }
    })
    app.get('/instruction/:id', function(request, response){
        var id = parseInt(request.param('id'));
        entity.Instruction.find_by_id(id, function(err, instruction) {
            response.show('instruction', {
                instruction: instruction
            });
        });
    });

    app.get('/settings', function(request, response){
        response.show('settings');
    });
    app.get('/plugins', function(request, response){
        response.show('plugins');
    });

    io.sockets.on('connection', function (socket) {
        socket.emit('connected');
        socket.on('delete User', function (data) {
            entity.User.find_by_id(parseInt(data.id), function(err, user){
                user.delete(function(){
                    socket.emit('User deleted', {id: user.__id__});
                });
            });
        });
    });

}
