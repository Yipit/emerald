#!/usr/bin/env node
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
var colors = require('colors');
if (!process.stdout.isTTY) {
    colors.mode = 'none';
}

var _ = require('underscore')._;
var async = require('async');
var program = require('commander');
var daemon = require('daemon');
var path = require('path');
var fs = require('fs');

var meta = require("../../package");
GLOBAL.settings = require("../../settings");

program
    .version(meta.version)
    .option('-s, --settings <path>', 'set the path for settings', function(settings_path){
        /* Taking care of relative paths */
        settings_path = path.resolve(settings_path);

        /* Nothing will be done with a path that points to nothing */
        if (!path.existsSync(settings_path)){
            console.log('the option', '-s/--settings'.yellow.bold, 'requires an existing path pointing to a valid settings file');
            process.exit(1);
        }

        var module = settings_path.replace(/[.](json|js)/, '');
        var newsettings = require(module);

        /* Flag that will mark the settings object as a customized version of
         * our default. This value will be used by the `app.server.dispatch`
         * function to load the same settings that the main process */
        newsettings.CUSTOM = settings_path;

        /* Merging the current settings object with the new one */
        GLOBAL.settings = _.extend(settings, newsettings);
    });

program
    .command('build <build-id>')
    .description('given a build id, runs it if never ran before')
    .action(function(build_id) {
        var entities = require("../server/models");
        var BuildRunner = require('../server/actors/buildrunner').BuildRunner;

        entities.Build.fetch_by_id(build_id, function(err, build){
            if (err) {
                console.log(err.toString());
                console.log(err.stack.toString());
                return;
            }
            var runner = new BuildRunner(build);
            runner.start();
        });
    });

program
    .command('run')
    .option('-d, --daemon', 'run as a daemon')
    .description('runs emerald')
    .action(function(options) {
        if (options.daemon) {
            process.stdout.write(["Preparing to run", 'emerald'.green, 'as a daemon... '].join(" "));
            async.waterfall([
                function check_if_already_running (callback){
                    path.exists(settings.PID_PATH, function(is_there){
                        return callback(null, is_there);
                    });
                },
                function open_if_already_exists(is_there, callback){
                    if (is_there) {
                        fs.readFile(settings.PID_PATH, callback);
                    } else {
                        callback(null, null);
                    }
                },
                function kill_aggressively_if_necessary(_pid, callback) {
                    var pid = parseInt(_pid, 10);

                    try {
                        if (pid !== process.pid) {
                            process.kill(pid, 'SIGKILL');
                        }
                    } catch (e){

                    }

                    callback(null);
                },
                function daemonize_the_process (callback) {
                    daemon.daemonize({
                        stdout: settings.STDOUT_PATH,
                        stderr: settings.STDERR_PATH
                    }, settings.PID_PATH, callback);
                }
            ], function (err, pid){
                /* this callback is within the daemon's context, it
                 * means all the code here will run daemonized */
                if (err) {
                    console.log('Error starting daemon: ' + err.toString());
                    console.log(err.stack);
                    process.reallyExit(6);
                }
                var emerald = require('../server/main');
                emerald.run();
            });

            console.log("OK".yellow.bold, "\n");
            console.log("PID file at:", settings.PID_PATH.yellow.bold);
            console.log("STDOUT at:", settings.STDOUT_PATH.yellow.bold);
            console.log("STDERR at:", settings.STDERR_PATH.yellow.bold);
        } else {
            console.log(["Running", 'emerald'.green, '... '].join(" "));
            var emerald = require('../server/main');
            emerald.run();
        }
    });

program.parse(process.argv);