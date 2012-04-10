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
var async = require('async');
var dispatch = require('../command').dispatch;
var logger = require('./base').logger;
var EmeraldModel = require('./base').EmeraldModel;
var Build = require('./build').Build;
var STAGES_BY_NAME = require('./base').STAGES_BY_NAME;
var STAGES_BY_INDEX = require('./base').STAGES_BY_INDEX;


var BuildInstruction = EmeraldModel.subclass("BuildInstruction", function(it, kind) {
    it.has.field("name", kind.string);
    it.has.field("slug", kind.string);
    it.has.field("description", kind.string);
    it.has.field("repository_address", kind.string);
    it.has.field("branch", kind.string);
    it.has.field("timeout_in_seconds", kind.numeric);
    it.has.field("build_script", kind.string);
    it.has.field("poll_interval", kind.numeric);
    it.has.field("max_build_time", kind.numeric);
    it.has.field("is_building", kind.numeric);

    it.has.index("slug");

    it.has.getter('last_build', function() {
        return this.all_builds.length > 0 ? this.all_builds[0] : null;
    });

    it.has.getter('last_success', function() {
        return this.succeeded_builds.length > 0 ? this.succeeded_builds[0] : null;
    });

    it.has.getter('last_failure', function() {
        return this.failed_builds.length > 0 ? this.failed_builds[0] : null;
    });

    it.has.getter('keys', function() {
        var prefix = 'emerald-m2i:Instruction:' + this.__id__ + ':';
        return {
            all_builds: prefix + 'all_builds',
            succeeded_builds: prefix + 'succeeded_builds',
            failed_builds: prefix + 'failed_builds',
            for_build_id: function(id){
                return 'clay:Build:id:' + id;
            }
        };
    });

    it.has.method('toString', function() {
        return this.toBackbone();
    });

    it.has.method('toBackbone', function() {
        var self = this;
        var data = this.__data__;

        data.id = data.__id__;
        ['all_builds', 'succeeded_builds', 'failed_builds'].forEach(function(attribute){
            /* Setters and getters that uses these attributes do not check
             * if these attributes exists or not. So this ensures that no
             * "access to undefined attribute" error will happen. */
            if (!self[attribute]) {
                self[attribute] = [];
                data[attribute] = [];
            } else {
                data[attribute] = self[attribute].map(function(b) {
                    return b.toBackbone();
                });
            }
        });

        data.permalink = settings.EMERALD_DOMAIN + "#instruction/" + data.__id__;
        data.is_building = self.is_building || 0;
        data.current_build = self.current_build || null;
        data.github_hook_url = [settings.EMERALD_DOMAIN, 'hooks/github', this.__id__].join('/');
        Object.defineProperty(data, "last_build", {
            get: function(){return self.last_build; },
            enumerable : true,
            configurable : true
        });
        if (data.all_builds.length === 0) {
            data.total_builds = 'never built';
        } else {
            data.html_class_name = data.last_build.html_class_name;
            if (data.all_builds.length === 1){
                data.total_builds = 'built once';
            } else {
                data.total_builds = 'built ' + data.all_builds.length + ' times';
            }
        }

        return data;
    });


    /* This method does more than a simple fetch_by_id(). It fills the
     * build list of the found instance, by calling the method
     * `BuildInstruction.with_builds_from_data()' against the query
     * result. */
    it.has.class_method('fetch_by_id', function(id, callback) {
        async.waterfall([
            function fetch_instruction (callback){
                BuildInstruction.find_by_id(id, callback);
            },
            function fetch_builds (instruction, callback){
                BuildInstruction.with_builds_from_data(instruction.__data__, callback);
            }
        ], callback);
    });


    /* Lists all builds associated with this BuildInstruction, in all of
     * the possible types of keys: successful, failed etc. */
    it.has.class_method('get_latest_with_builds', function(callback) {
        var self = this;
        var redis = self._meta.storage.connection;

        async.waterfall([
            function fetch_all_instruction_keys (callback){
                logger.debug('get_latest_with_builds: getting keys');
                redis.keys('clay:BuildInstruction:id:*', callback);
            },
            function get_instructions_data (keys, callback){
                logger.debug(['get_latest_with_builds: getting data', keys]);
                async.map(keys, function(key, callback){
                    return redis.hgetall(key, callback);
                }, callback);
            },
            function turn_into_instructions (instructions, callback){
                logger.debug(['get_latest_with_builds: turning into instructions', instructions]);
                async.map(instructions, function(data, callback){
                    BuildInstruction.with_builds_from_data(data, callback);
                }, callback);
            },
            function backbone_them (instructions, callback){
                logger.debug(['get_latest_with_builds: turning into backbone-ish data', instructions]);
                async.map(instructions, function(i, callback){
                    callback(null, i.toBackbone());
                }, callback);
            }
        ], callback);
    });


    /* Finds all Build instances associated with the BuildInstruction
     * represented by the `data' parameter. The return is divided in
     * `all_builds', 'succeeded_builds' and 'failed_builds'.
     *
     * Another important thing is that this function also decides if
     * this instruction is running or not in the current time. */
    it.has.class_method('with_builds_from_data', function(data, callback) {
        var self = new this(data);
        var redis = this._meta.storage.connection;

        function filter_builds(builds){
            return _.filter(builds, function(b){
                return !_.isNull(b) && !_.isUndefined(b); });
        }

        async.waterfall([
            function get_all_builds(callback) {
                redis.zrevrange(self.keys.all_builds, 0, -1, function(err, builds){
                    async.map(builds, function(key, callback){
                        return Build.fetch_by_key(key, callback);
                    }, function(err, builds){
                        callback(err, filter_builds(builds));
                    });
                });
            },
            function get_succeeded_builds(all_builds, callback) {
                redis.zrevrange(self.keys.succeeded_builds, 0, -1, function(err, builds){
                    async.map(builds, function(key, callback){
                        return Build.fetch_by_key(key, callback);
                    }, function(err, succeeded_builds){
                        callback(err, all_builds, filter_builds(succeeded_builds));
                    });
                });
            },
            function get_failed_builds(all_builds, succeeded_builds, callback) {
                redis.zrevrange(self.keys.failed_builds, 0, -1, function(err, builds){
                    async.map(builds, function(key, callback){
                        return Build.fetch_by_key(key, callback);
                    }, function(err, failed_builds){
                        callback(err, all_builds, succeeded_builds, filter_builds(failed_builds));
                    });
                });
            },
            function check_if_has_a_current_build (all_builds, succeeded_builds, failed_builds, callback) {
                Build.get_current(function(err, current_build){
                    if (err) {
                        logger.handleException(err);
                        return callback(null, all_builds, succeeded_builds, failed_builds);
                    }

                    /* It's possible to get a null value from the .fetch_by_key()
                     * method, used by the Build.get_current() method. This way,
                     * we must be sure that we'll not fail if no current build
                     * exists. */
                    if (current_build && parseInt(current_build.instruction_id, 10) === self.__id__) {
                        self.is_building = 1;
                        self.current_build = current_build;
                    } else {
                        self.current_build = null;
                        self.is_building = 0;
                    }
                    return callback(null, all_builds, succeeded_builds, failed_builds);
                });
            }
        ], function(err, all_builds, succeeded_builds, failed_builds){
            self.all_builds = all_builds;
            self.succeeded_builds = succeeded_builds;
            self.failed_builds = failed_builds;
            return callback(err, self);
        });
    });
    it.has.method('run', function() {
        var self = this;

        var redis = self._meta.storage.connection;

        async.waterfall([
            function change_building_status(callback) {
                self.is_building = 1;
                self.save(function (err) {
                    callback(err);
                });
            },
            function get_next_build_index(callback) {
                redis.zcard(self.keys.all_builds, callback);
            },
            function increment_index(total, callback){
                var index = parseInt(total, 10) + 1;
                callback(null, index);
            },
            function create_an_empty_build (index, callback) {
                Build.create({
                    stderr: "",
                    stdout: "",
                    output: "",
                    signal: 'SIGKILL',
                    status: 1,
                    stage: STAGES_BY_NAME.BEGINNING,
                    build_started_at: new Date(),
                    instruction_id: self.__id__,
                    index: index
                }, callback);
            }
        ], function(err, key, build) {
            if (err) {
                logger.fail('an error happened while creating a build for the instruction "'+self.name+'"');
                logger.handleException(err);
                return;
            }

            dispatch('build', [build.__id__], function (child) {
                build.pid = child.pid;
                build.save(function(err, key, build) {
                    redis.publish('Build running', JSON.stringify({
                        build: build.toBackbone(),
                        instruction: self.toBackbone()
                    }));
                });

                child.on('exit', function(code, signal) {
                    if ((code !== 0) && signal) {
                        build.stage = STAGES_BY_NAME.ABORTED;
                        build.signal = signal;
                    } else if (parseInt(code, 10) !== 0) {
                        build.stage = STAGES_BY_NAME.FAILED;
                    }

                    build.save(function(err, key, build){
                        Build.fetch_by_id(build.__id__, function(err, build){
                            redis.publish('Build aborted', JSON.stringify({
                                build: build.toBackbone(),
                                instruction: build.instruction.toBackbone(),
                                error: err
                            }));
                        });
                    });

                    /* Just setting the instruction build status again to
                     * false. */
                    self.is_building = 0;
                    self.save(function (err) {});
                });
            });
        });
    });
});


exports.BuildInstruction = BuildInstruction;
