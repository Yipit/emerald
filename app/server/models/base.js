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

/* -- Imports -- */

var clay = require('clay');
var LoggerClass = require('../logger').Logger;

/* -- Public stuff -- */


exports.logger = new LoggerClass("[ MODELS ]".green.bold);


exports.STAGES_BY_INDEX = {
    0: 'BEGINNING',
    1: 'FETCHING',
    2: 'PREPARING_ENVIRONMENT',
    3: 'RUNNING',
    4: 'ABORTED',
    5: 'FAILED',
    6: 'SUCCEEDED'
};


exports.STAGES_BY_NAME = {
    BEGINNING: 0,
    FETCHING: 1,
    PREPARING_ENVIRONMENT: 2,
    RUNNING: 3,
    ABORTED: 4,
    FAILED: 5,
    SUCCEEDED: 6
};


exports.default_storage = function () {
    var Build = require('./build').Build;
    return Build._meta.storage;
};


exports.EmeraldModel = clay.declare("EmeraldModel", function(it, kind) {
    it.has.method('toString', function() {
        return this.toBackbone();
    });

    it.has.class_method('get_by_id_or_404', function(id, callback) {
        this.fetch_by_id(parseInt(id, 10), function(err, instance) {
            var status;
            var headers = { 'Content-Type': 'application/json' };
            if (err) {
                status = 404;
                instance = {
                    message: err.toString(),
                    stack: err.stack.toString()
                };
            } else {
                status = 200;
            }
            return callback(instance, headers, status);
        });
    });
});
