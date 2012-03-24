/* Emerald - Continuous Integration server focused on real-time interactions
 *
 *   Copyright (C) 2012  Gabriel Falcão <gabriel@yipit.com>
 *   Copyright (C) 2012  Yipit Inc. <coders@yipit.com>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
var async = require('async');

function mkdirIfNotExist(target, mode, callback){
    path.exists(target, function(exists){
        return exists ? callback(null) : mkdirp(target, mode, callback);
    });
}
exports.now = function(app, io, redis, callback) {
    var logger = new (require('./logger').Logger)("[STARTUP]".yellow.bold);
    async.reject([settings.EMERALD_PATH, settings.SANDBOX_PATH], path.exists, function(folders_to_create) {
        async.forEach(folders_to_create, function(folder, cb) {
            logger.info(["creating", folder]);
            mkdirp(folder, parseInt('0755', 8), cb);
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

    /* handling CONTROL-C */

    process.on("SIGINT", function(signal){
        var unicode_heart = String.fromCharCode(0x2764).red;

        /* handling control-C */
        process.stdout.write('\r  \n');
        console.log(['EMERALD'.green, 'caught a'.white, 'CONTROL-C'.red.bold, unicode_heart].join(' ').green.bold);

        if (!redis.connected) {
            process.reallyExit(1);
        }
        process.stdout.write('Cleaning up redis... ');
        async.waterfall(
            [
                function looking_for_emerald_stuff_in_redis(callback){
                    /* matching keys */
                    redis.keys("emerald:*", callback);
                },
                function clean_whatever_requires_to (keys, callback){
                    /* cleaning up queue, cache, etc. */
                    async.forEach(keys, function(key, callback){
                        redis.del(key, callback);
                    }, callback);
                }
            ], function(err) {
                if (err) {
                    process.stdout.write('FAILED\n\n'.red.bold);
                    console.log(['Exception:', err.toString()].join(' ').red.bold);
                    console.log(err.stack.toString().red.bold);
                } else {
                    process.stdout.write('OK\n\n'.green.bold);
                }
                redis.save(function(){
                    logger.info("asking redis to dump its in-memory data to the disk");
                    process.reallyExit(1);
                });
            });
    });

    process.on('uncaughtException', function (err) {
        logger.fail("EMERALD has quit due an internal crash".red.bold);
        logger.fail("it's now executing some procedures in order to clean up the build environment".red.bold);
        logger.fail("I'm gonna show you the traceback in a second.".red.bold);

        var original_exception = err;
        async.waterfall([
            function looking_for_emerald_stuff_in_redis(callback){
                /* matching keys */
                redis.keys("emerald:*", callback);
            },
            function clean_whatever_requires_to (keys, callback){
                /* cleaning up queue, cache, etc. */
                logger.info("cleansing out redis stuff...".white.bold);
                async.forEach(keys, function(key, callback){
                    redis.del(key, callback);
                }, callback);
            }], function(err) {
                if (err) {
                    logger.warning(['There was also a failure while cleaning up redis...', err.toString() + ''].join('"').yellow.bold);
                    logger.warning(err.stack.toString().yellow.bold);
                } else {
                    logger.info("redis cleansed successfully".white.bold);
                }

                logger.fail(['Original exception: ', original_exception.toString(), ''].join('"').red.bold);
                console.log((original_exception.stack + "").yellow.bold);
                redis.save(function(){
                    logger.info("asking redis to dump its in-memory data to the disk");
                    process.reallyExit(err && 1 || 0);
                });
            });
    });
};
