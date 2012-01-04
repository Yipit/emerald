var _ = require('underscore')._;
var entity = require("./models");
var settings = require('./settings');
var async = require('async');
var path = require('path');
var fs = require('fs');
var logger = new (require('./logger').Logger)("[controllers]".yellow);

exports.map = function(app, redis){
    app.get('/', function(request, response){
        async.waterfall([
            function scan_filesystem(callback){
                console.log('settings.BACKBONE_VIEW_PATH', settings.BACKBONE_VIEW_PATH)
                fs.readdir(settings.BACKBONE_VIEW_PATH, callback);
            },
            function read_files(files, callback){
                async.map(files, function(name, callback){
                    var fullpath = path.join(settings.BACKBONE_VIEW_PATH, name);
                    fs.readFile(fullpath, function(err, data){
                        callback(err, {
                            name: name.replace(/[.]html$/, ''),
                            html: data.toString()
                        });
                    });
                }, callback);
            }
        ], function(err, templates) {
            logger.handleException(err);
            var emerald_meta = {
                domain: settings.EMERALD_DOMAIN,
                hostname: settings.EMERALD_HOSTNAME,
                port: settings.EMERALD_PORT
            };
            var context = {
                title: 'Emerald - Continuous Integration',
                request: request,
                err: err,
                templates: templates,
                emerald: emerald_meta,
                emerald_json: JSON.stringify(emerald_meta),
            };
            return response.render('index', context)
        });
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
