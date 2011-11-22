var entity = require("./models");

exports.start = function(app, io){
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
                    build_script: request.param('build_script')
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
        entity.BuildInstruction.find_by_id(id, function(err, instruction) {
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
        socket.on('delete BuildInstruction', function (data) {
            entity.BuildInstruction.find_by_id(parseInt(data.id), function(err, instruction){
                instruction.delete(function(){
                    socket.emit('BuildInstruction deleted', {id: instruction.__id__});
                });
            });
        });
    });

}
