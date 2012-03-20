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
    this.pubsub = require('redis').createClient();

    /* subscribe to the pubsub event fired when a new build instruction
     * is created  */
    var self = this;
    this.pubsub.subscribe('BuildInstruction created');
    this.pubsub.subscribe('BuildInstruction deleted');
    this.pubsub.subscribe('BuildInstruction edited');
    this.pubsub.on('message', function (channel, message) {
        switch (channel) {
        case 'BuildInstruction created':
        case 'BuildInstruction edited':
            self.register_instruction(JSON.parse(message));
            break;
        case 'BuildInstruction deleted':
            self.unregister_instruction(JSON.parse(message).instruction);
            break;
        }
    });
}


/**
 * Unregister a struction from our local cache.
 */
GitPoller.prototype.unregister_instruction = function (instruction) {
    var self = this;
    if (self.repos[instruction.id] !== undefined) {
        clearInterval(self.repos[instruction.id]);
        delete self.repos[instruction.id];
    }
};


/**
 * Registers a new (or edited) instruction in our local cache
 *
 * This method uses the `instruction.id' as the field. This way, every
 * editable field can be changed without losing the instruction
 * reference.
 */
GitPoller.prototype.register_instruction = function (instruction) {
    var self = this;

    /* This line bellow makes this function safe to be called
     * more than once with the same instruction without registering more
     * than one poll a single for repo */
    self.unregister_instruction(instruction);

    /* Let's register an interval to pull the repo */
    var interval = (instruction.poll_interval || 0) * 1000;
    if (interval > 0) {
        self.repos[instruction.id] = setInterval(function () {
            self.single_update(instruction);
        }, interval);
    }
};


/**
 * Actually does the update of a repository, if it exists
 */
GitPoller.prototype.single_update = function (instruction) {
    var self = this;

    if (instruction.is_building) {
        logger.info('skipping the git pull on "' + instruction.name +
                    '", that is being currently built');
    } else {
        logger.info('preparing to pull the repo from "' + instruction.name + '"');
    }

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


/**
 * Method called to register all available instructions in the boot
 * time.
 */
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

            self.register_instruction(item);
        });
        return;
    });
};

exports.start = function() {
    (new GitPoller()).start();
};
