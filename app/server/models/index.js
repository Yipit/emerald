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

var base = require('./base');

function clear_keys(pattern, callback) {
    var connection = base.default_storage().connection;
    var self = this;
    var pattern_list = (pattern instanceof Array) ? pattern: [pattern];
    var exception;
    var key_list = [];

    pattern_list.forEach(function(pattern){
        connection.keys(pattern, function(err, keys) {
            if (err) {
                exception = err;
                return;
            }

            keys.forEach(function(key) {
                key_list.push(key);
            });

            if (pattern === pattern_list.last) {
                connection.del(key_list, function(err) {
                    return callback(exception, key_list);
                });
            }
        });
    });
}

module.exports = {
    BuildInstruction: require('./buildinstruction').BuildInstruction,
    Build: require('./build').Build,
    Pipeline: require('./pipeline').Pipeline,
    connection: base.default_storage().connection,
    storage: base.default_storage(),
    clear_keys: clear_keys,
    STAGES_BY_INDEX: base.STAGES_BY_INDEX,
    STAGES_BY_NAME: base.STAGES_BY_NAME
};
