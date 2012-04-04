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

var async = require('async');
var EmeraldModel = require('./base').EmeraldModel;

exports.Pipeline = EmeraldModel.subclass('Pipeline', function (it, kind) {
    it.has.field("name", kind.string);
    it.has.field("description", kind.string);

    it.has.method('toBackbone', function () {
        return this.__data__;
    });

    it.has.class_method('fetch_all', function (callback) {
        var redis = this._meta.storage.connection;

        async.waterfall([
            function get_keys(callback) {
                redis.keys('clay:Pipeline:id:*', callback);
            },

            function get_items(keys, callback) {
                async.map(keys, function (key, callback) {
                    return redis.hgetall(key, callback);
                }, callback);
            },

            function return_items(items, callback) {
                callback(null, items);
            }
        ], callback);
    });
});
