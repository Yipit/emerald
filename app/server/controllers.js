/***************************************************************************
Emerald - Continuous Integration server focused on real-time interactions
Copyright (C) <2012>  Gabriel Falcão <gabriel@yipit.com>
Copyright (C) <2012>  Yipit Inc. <coders@yipit.com>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
 ***************************************************************************/
var _ = require('underscore')._;
var entity = require('./models');
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
                    emerald_json: JSON.stringify(emerald_meta)
                };
                return _callback_(err, context, request, response);
            });
        };
    }
    app.get('/', controller(function(err, context, request, response){
        return response.render('index', context);
    }));

    app.get('/_design', controller(function(err, context, request, response){
        return response.render('design', context);
    }));

    app.post('/hooks/github/:project_slug', function(request, response){
        var headers = {
            'Content-Type': 'application/json'
        };
        var slug = request.param('project_slug');
        logger.info(['GitHub just sent a payload that hooks up to the instruction with slug:', slug]);
        return entity.BuildInstruction.find_by_slug(slug, function(err, found){
            if (err) {
                logger.handleException(err, "/hooks/github/" + slug);
                return response.send(headers, 404);
            }
            var instruction = found[0];
            instruction.run();
            return response.send(headers, 201);
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
            Model.get_by_id_or_404(request.param('id'), function(instance, headers, status){
                return response.json(instance.toString(), headers, status);
            });
        });
        app.put('/api/' + name + '/:id.json', function(request, response){
            Model.get_by_id_or_404(request.param('id'), function(instance, headers, status){
                _.each(instance._meta.field.names, function(name){
                    var value = request.param(name);
                    if (value) {
                        instance[name] = value;
                    }
                });
                instance.save(function(err){
                    if (err) {
                        return response.json('', headers, 500);
                    }
                    return response.json('', headers, 200);
                });

            });
        });
    });

    app.put('/api/instruction/new', function(request, response){
        var headers = {'Content-Type': 'application/json'};
        var data = request.body;
        data.slug = data.name;
        entity.BuildInstruction.create(data, function(err, key, instruction){
            var data = instruction.toBackbone();
            redis.publish('BuildInstruction created', JSON.stringify(data));
            response.json(data, 201);
        });
    });
};
