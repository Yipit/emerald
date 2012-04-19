/* Emerald - Continuous Integration server focused on real-time interactions
 *
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

var _ = require('underscore')._;
var spawn = require('child_process').spawn;

module.exports.dispatch = function (command, args, callback) {
    var self = this;
    var spawn_args = [];

    spawn_args.push('--max_new_space_size=5000');
    spawn_args.push('--max_executable_size=3000');
    spawn_args.push('--max_old_space_size=5000');
    spawn_args.push(settings.SCRIPT_PATH);

    /* Looking for the settings file that the current process is using */
    if (settings.CUSTOM) {
        spawn_args.push('-s');
        spawn_args.push(settings.CUSTOM);
    }

    spawn_args.push(command);

    /* Putting all parameters together */
    spawn_args = _.union(spawn_args, args);

    console.log("spawn_args");
    console.log(spawn_args);

    var child = spawn("node", spawn_args);
    child.stdout.on('data', function(data) {
        process.stdout.write(data);
    });
    child.stderr.on('data', function(data) {
        process.stdout.write(data);
    });

    callback(child);
};
