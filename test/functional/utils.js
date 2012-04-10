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

var async = require('async');
var redis = require('redis').createClient();

/* Shamelessly stolen from clay functional tests :) */

exports.clear_redis = function(callback) {
    var topic = this;
    callback = callback !== undefined ? callback : new Function();
    async.waterfall([
        function get_keys(callback) {
            redis.keys('clay:*', callback);
        },
        function delete_keys (keys, callback) {
            async.map(keys, function(key, callback){
                redis.del(key, function(err){
                    return callback(err, key);
                });
            }, callback);
        }
    ], callback);
}
