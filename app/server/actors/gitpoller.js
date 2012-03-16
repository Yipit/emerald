/* Emerald - Continuous Integration server focused on real-time interactions
 *
 *     Copyright (C) 2012  Yipit Inc. <coders@yipit.com>
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

var _ = require('underscore')._;
var colors = require('colors');
var spawn = require('child_process').spawn;
var async = require('async');
var path = require('path');
var common = require('./common');
var settings = require('../../../settings');
var logger = new (require('../logger').Logger)("[ GITPOLLER ]".yellow.bold);
var BuildInstruction = require('../models').BuildInstruction;


function GitPoller() {
    this.repos = {};
    this.redis = BuildInstruction._meta.storage.connection;
}


GitPoller.prototype.single_update = function (instruction) {
    logger.info('preparing to pull the repo from "' + instruction.name + '"');
    var self = this;

    async.waterfall([
        function git_spawn(callback) {
            var branch = instruction.branch || "master";
            var opts = { cwd: common.repo_path(instruction) };
            path.exists(opts.cwd, function (exists) {
                if (exists) {
                    self.redis.publish('Repository started updating', JSON.stringify({
                        at: new Date(),
                        instruction: instruction
                    }));

                    var child = spawn('git', ['pull', 'origin', branch], opts);
                    callback(null, child);
                } else {
                    logger.info('No repo found for "' + instruction.name + '"');
                }
            });
        },
        function git_handle_exit(child, callback) {
            logger.info('handling the end of git execution');
            child.on('exit', function (code, signal) {
                if (code === 0) {
                    logger.info('Successfuly finished updating repo "' + instruction.name + '" from git');
                }

                self.redis.publish('Repository finished updating', JSON.stringify({
                    at: new Date(),
                    instruction: instruction
                }));
            });
            callback(null);
        }
    ]);
};


GitPoller.prototype.start = function () {
    var self = this;

    logger.info('Acquiring the list of instructions to be updated');
    BuildInstruction.get_latest_with_builds(function (err, instructions) {
        if (err) {
            logger.error('Unable to list instructions');
            return;
        }

        instructions.forEach(function (item) {
            /* We won't pull repositories being built */
            if (item.is_building) return;

            /* We'll do nothing if interval is set to < 1 */
            if (item.poll_interval < 1)
                return;

            /* This line bellow makes this function safe to be called
             * more than once with the same list of repositories */
            if (self.repos[item.name] !== undefined) {
                clearInterval(self.repos[item.name]);
                delete self.repos[item.name];
            }

            /* Let's poll all repos in an interval */
            var interval = item.poll_interval || settings.GIT_POLL_INTERVAL_2;
            self.repos[item.name] = setInterval(function () {
                self.single_update(item);
            }, interval);
        });
        return;
    });
};

exports.start = function() {
    (new GitPoller()).start();
};
