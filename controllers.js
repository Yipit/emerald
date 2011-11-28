var entity = require("./models");

exports.start = function(app, io){
    app.get('/', function(request, response){
        response.show('index');
    });
    app.get('/logout', function(request, response){
        request.session.user_id = null;
        response.redirect(request.param('next', '/'));
    });
    app.all('/login', function(request, response){
        if (request.method === "POST") {
            entity.User.authenticate(request.param('email'), request.param('password'), function(err, user) {
                if (!err) {
                    request.session.user_id = user.__id__;
                    response.redirect(request.param('next', '/'));
                } else {
                    console.log(err)
                    return response.show('login', {error: err});
                }
            });
        } else {
            return response.show('login', {error: null});
        }
    });

    app.all('/users', function(request, response){
        switch (request.method) {
            case "GET":
                entity.User.all(function(err, users){
                    response.show('manage-users', {users: users, has_users: users.length > 0});
                });
            break;
            case "POST":
                var naive = new entity.User({
                    name: request.param('name'),
                    email: request.param('email'),
                    password: request.param('password')
                });
                naive.save(function(err, key, instruction) {
                    response.redirect('/user/' + instruction.__id__)
                });
            break;
            default:
                response.send('method not allowed', 405);
            break;
        }
    })
    app.get('/user/:id', function(request, response){
        var id = parseInt(request.param('id'));
        entity.BuildInstruction.find_by_id(id, function(err, instruction) {
            response.show('instruction', {
                instruction: instruction
            });
        });
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
                response.send('method not allowed', 405);
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
    app.get('/profile', function(request, response){
        response.show('profile');
    });

    io.sockets.on('connection', function (socket) {
        socket.emit('connected');
        socket.on('delete BuildInstruction', function (data) {
            entity.BuildInstruction.find_by_id(parseInt(data.id), function(err, instruction){
                instruction.delete(function(){
                    socket.broadcast.emit('BuildInstruction deleted', {id: instruction.__id__});
                });
            });
        });
        socket.on('delete User', function (data) {
            entity.User.find_by_id(parseInt(data.id), function(err, instruction){
                instruction.delete(function(){
                    socket.broadcast.emit('User deleted', {id: instruction.__id__});
                });
            });
        });

    });

}
