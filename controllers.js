var _ = require('underscore')._;
var entity = require("./models");
var settings = require('./settings');
var async = require('async');
var logger = new (require('./logger').Logger)("[controllers]".yellow);

exports.map = function(app, redis){
    app.get('/', function(request, response){
        response.show('index');
    });

    app.get('/api/instructions.json', function(request, response){
        entity.BuildInstruction.get_latest_with_builds(function(err, instructions){
            response.send(JSON.stringify(instructions), {'Content-Type': 'application/json'}, 200);
        });
    });

    _.each({
        'build': entity.Build,
        'instruction': entity.BuildInstruction
    }, function(Model, name){
        /* defining the controller responsible to fetch ONLY one instance */
        app.get('/api/' + name + '/:id.json', function(request, response){
            Model.find_by_id(parseInt(request.param('id')), function(err, instance){
                var headers = {'Content-Type': 'application/json'};
                var raw = JSON.stringify(instance.toBackbone());
                response.send(raw, headers, 200);
            });
        });
    });
}
