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

var _ = require('underscore')._;
var crypto = require('crypto');
var moment = require('moment');
var async = require('async');
var logger = require('./base').logger;
var EmeraldModel = require('./base').EmeraldModel;
var STAGES_BY_NAME = require('./base').STAGES_BY_NAME;
var STAGES_BY_INDEX = require('./base').STAGES_BY_INDEX;


exports.Build = EmeraldModel.subclass("Build", function(it, kind) {
    it.has.field("index", kind.numeric);
    it.has.field("status", kind.string);
    it.has.field("signal", kind.string);
    it.has.field("stderr", kind.string);
    it.has.field("stdout", kind.string);
    it.has.field("output", kind.string);
    it.has.field("pid", kind.numeric);
    it.has.field("stage", kind.numeric);
    it.has.field("commit", kind.string);
    it.has.field("message", kind.string);
    it.has.field("author_name", kind.string);
    it.has.field("author_email", kind.string);
    it.has.field("build_started_at", kind.string);
    it.has.field("build_finished_at", kind.string);
    it.has.field("fetching_started_at", kind.string);
    it.has.field("fetching_finished_at", kind.string);
    it.has.field("instruction_id", kind.numeric);

    it.has.method('increment_stdout', function(value, callback){
        var self = this;
        async.waterfall([
            function(callback){
                self.concat("stdout", value, callback);
            },
            function(full, current, wrong_value, callback){
                self.concat("output", value, callback);
            }
        ], callback);
    });

    it.has.method('increment_stderr', function(value, callback){
        var self = this;
        async.waterfall([
            function(callback){
                self.concat("stderr", value, callback);
            },
            function(full, current, wrong_value, callback){
                self.concat("output", value, callback);
            }
        ], callback);
    });

    it.has.method('gravatar_of_size', function(size){
        var hash = crypto.createHash('md5');
        hash.update(this.author_email || '');
        return 'http://www.gravatar.com/avatar/' + hash.digest('hex') + '?s=' + size;
    });

    it.has.getter('succeeded', function() {
        return ((parseInt(this.status || 0, 10) === 0) && this.signal === 'null');
    });

    it.has.getter('stage_name', function() {
        return (STAGES_BY_INDEX[this.stage]).toLowerCase();
    });

    it.has.getter('duration', function() {
        var finished = moment(this.finished_at);
        return finished.fromNow();
    });

    it.has.getter('started_at', function() {
        return this.build_started_at || this.fetching_started_at;
    });

    it.has.getter('finished_at', function() {
        return this.build_finished_at || this.fetching_finished_at;
    });

    it.has.method('abort', function() {
        var self = this;
        var signal = 'SIGKILL';
        var redis = this._meta.storage.connection;

        self.stage = STAGES_BY_NAME.ABORTED;

        var logging_prefix = ('[aborting Build #'+this.__id__+']').red.bold;

        logger.info([logging_prefix, 'the stage was set to:', self.stage]);

        self.save(function(err){
            if (self.pid) {
                logger.info([logging_prefix, 'killing build (pid: ' + self.pid + ')']);
                try {
                    process.kill(self.pid, signal);
                } catch (e){
                    logger.fail([logging_prefix, 'PID'.yellow.bold, self.pid, e.toString()]);
                    logger.fail(e.stack.toString());
                }
            }
            logger.success([logging_prefix, 'DONE!']);
        });
    });

    it.has.class_method('get_current', function(callback) {
        var self = this;
        async.waterfall([
            function get_current_build_id(callback){
                self._meta.storage.connection.get(settings.REDIS_KEYS.current_build, callback);
            },
            function try_to_fetch_it(id, callback) {
                /* No ID to query, no instance to return */
                if (id === null) { return callback(null, null); }

                /* Here, it does make sense to try to fetch an instance by a
                 * real id */
                return Build.fetch_by_key('clay:Build:id:' + id, callback);
            }
        ], callback);
    });

    it.has.class_method('fetch_by_id', function(id, callback) {
        return this.find_by_id(id, function(err, build){
            if (err) {
                return callback(err);
            }

            var instruction_id = parseInt(build.instruction_id, 10);
            if (instruction_id < 0) {
                return callback(err, build);
            }

            var BuildInstruction = require('./buildinstruction').BuildInstruction;
            BuildInstruction.fetch_by_id(instruction_id, function(err, instruction){
                if (err) {return callback(err);}

                Object.defineProperty(build, "instruction", {
                    get: function(){return instruction;},
                    enumerable : false,
                    configurable : false
                });
                return callback(err, build);
            });

            return null;
        });
    });

    it.has.class_method('fetch_by_key', function(key, callback) {
        var self = this;
        var redis = this._meta.storage.connection;

        redis.hgetall(key, function(err, data){
            var instance = data;
            err = err || (_.isEmpty(data) && new Error('no build was found for the key ' + key));

            if (!err) {
                instance = new self(data);
            }
            return callback(err, instance);
        });
    });

    it.has.method('toBackbone', function() {
        var data = this.__data__;
        data.id = data.__id__;

        data.gravatars = {
            "50": this.gravatar_of_size(50),
            "75": this.gravatar_of_size(75),
            "100": this.gravatar_of_size(100),
            "125": this.gravatar_of_size(125),
            "150": this.gravatar_of_size(150),
            "300": this.gravatar_of_size(300)
        };

        data.style_name = this.stage_name.toLowerCase();

        switch (STAGES_BY_INDEX[this.stage]) {
        case 'SUCCEEDED':
            data.html_class_name = 'alert-success';
            break;
        case 'FAILED':
        case 'ABORTED':
            data.html_class_name = 'alert-error';
            break;

        default:
            break;
        }


        data.succeeded = JSON.parse(this.succeeded);
        data.stage_name = this.stage_name;
        data.route = "#build/" + data.__id__;
        data.permalink = settings.EMERALD_DOMAIN + "#build/" + data.__id__;
        data.started_at = this.started_at;
        data.finished_at = this.finished_at;
        data.is_building = parseInt(this.stage, 10) < STAGES_BY_NAME.ABORTED;

        var convert = function (s) {
            return moment(new Date(s)).fromNow();
        };

        data.humanized = {
            "build_started": convert(this.build_started_at),
            "build_finished": convert(this.build_finished_at),
            "fetching_started": convert(this.fetching_started_at),
            "fetching_finished": convert(this.fetching_finished_at)
        };
        if (_.isObject(this.instruction) && _.isFunction(this.instruction.toBackbone)) {
            data.instruction = this.instruction.toBackbone();
        }
        data.has_message = _.isString(data.message);
        return data;
    });
});
