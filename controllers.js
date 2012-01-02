var entity = require("./models");
var settings = require('./settings');
var async = require('async');
var logger = new (require('./logger').Logger)("[controllers]".yellow);

exports.map = function(app, redis){
    app.get('/', function(request, response){
        entity.BuildInstruction.get_latest_with_builds(function(err, instructions){
            response.show('index', {
                instructions:instructions
            });
        });

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
                    console.log(err);
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
                naive.save(function(err, key, user) {
                    response.redirect('/user/' + user.__id__)
                });
            break;
            default:
                response.send('method not allowed', 405);
            break;
        }
    })
    app.get('/user/:id', function(request, response){
        var id = parseInt(request.param('id'));
        entity.User.find_by_id(id, function(err, user) {
            response.show('user', {
                user: user
            });
        });
    });
    app.get('/build/:id', function(request, response){
        var id = parseInt(request.param('id'));
        entity.Build.find_by_id(id, function(err, build) {
            response.show('build', {
                build: build
            });
        });
    });

    app.get('/instructions.json', function(request, response){
        entity.BuildInstruction.get_latest_with_builds(function(err, instructions){
            response.send(JSON.stringify(instructions), {'Content-Type': 'application/json'}, 200);
        });
    })

    app.all('/instructions', function(request, response){
        switch (request.method) {
            case "GET":
                entity.BuildInstruction.get_latest_with_builds(function(err, instructions){
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
}
