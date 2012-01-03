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

    app.get('/instructions.json', function(request, response){
        entity.BuildInstruction.get_latest_with_builds(function(err, instructions){
            response.send(JSON.stringify(instructions), {'Content-Type': 'application/json'}, 200);
        });
    })
}
