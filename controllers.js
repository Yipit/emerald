var _ = require('underscore')._;
var entity = require("./models");
var settings = require('./settings');
var async = require('async');
var path = require('path');
var fs = require('fs');
var logger = new (require('./logger').Logger)("[controllers]".yellow);

exports.map = function(app, redis){
    function controller (_callback_) {
        return function (request, response){
            async.waterfall([
                function scan_filesystem(callback){
                    fs.readdir(settings.BACKBONE_VIEW_PATH, callback);
                },
                function filter_for_valid_filenames(files, callback){
                    var pattern = /^\w+.*[.]html$/i;

                    return callback(null, _.filter(files, function(file){
                        return pattern.test(file);
                    }));
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
                return _callback_(err, context, request, response);
            });
        }
    }
    app.get('/', controller(function(err, context, request, response){
        return response.render('index', context)
    }));

    app.get('/_design', controller(function(err, context, request, response){
        return response.render('design', context)
    }));


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
            Model.fetch_by_id(parseInt(request.param('id')), function(err, instance){
                var status, raw;
                var headers = {'Content-Type': 'application/json'};
                if (err) {
                    raw = {
                        message: err.toString(),
                        stack: err.stack.toString()
                    };
                    status = 404;
                } else {
                    raw = JSON.stringify(instance.toBackbone());
                    status = 200;
                }
                response.send(raw, headers, status);
            });
        });
    });
}
