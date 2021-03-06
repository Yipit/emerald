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

/* Class responsible for interacting with the git clone command
 *
 * It receives an object with the following properties to be used by
 * the git-clone command:
 *
 * `uri`:
 * 
 *   The uri of the repo, starting with something like git:// or
 *   http:// but this function will not touch it, so every url
 *   compatible with git will work here.
 *
 * `branch`:
 *
 *   The name of the branch that should be clonned. If none, we'll
 *   assume the value "master"
 *
 * `path`:
 *
 *   Directory that will host this clone
 *
 * `timeout`
 *
 *   How many time (in seconds) this clone should take to run. If
 *   this value is not informed, no timeout will be added.
 */
function Clone(opts) {
    this.opts = opts;
}


Clone.prototype.__defineGetter__('args', function() {
    return [
        'clone', '--progress', '--branch',
        this.opts.branch || 'master',
        this.opts.uri,
        this.opts.path
    ];
});


Clone.prototype.__defineGetter__('cmd', function() {
    return _.union(['git'], this.args).join(' ');
});


Clone.prototype.start = function() {
    
};


exports.Clone = Clone;
