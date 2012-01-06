var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
var async = require('async');

var logger = new (require('./logger').Logger)("[STARTUP]".yellow.bold);

function mkdirIfNotExist(target, mode, callback){
    path.exists(target, function(exists){
        exists ? callback(null) : mkdirp(target, mode, callback);
    });
}
exports.now = function(app, io, redis, settings, callback) {
    async.reject([settings.EMERALD_PATH, settings.SANDBOX_PATH], path.exists, function(folders_to_create) {
        async.forEach(folders_to_create, function(folder, cb) {
            logger.info(["creating", folder]);
            mkdirp(folder, 0755, cb);
        }, function(err){
            if (err) {
                logger.fail(err.toString());
                process.exit(1);
            }
            process.chdir(settings.SANDBOX_PATH);
            logger.info(["emerald's current working directory is", settings.SANDBOX_PATH]);
            callback(settings.SANDBOX_PATH);
        });
    });
}