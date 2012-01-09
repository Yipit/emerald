var _ = require('underscore')._;
var models = require('clay');
var crypto = require('crypto');
var moment = require('moment');
var mkdirp = require('mkdirp');
var async = require('async');
var moment = require('moment');
var path = require('path');
var fs = require('fs');
var child_process = require('child_process');
var settings = require('../../settings');
var logger = new (require('./logger').Logger)("[ MODELS / RUNNER ]".green.bold);

var STAGES_BY_INDEX = {
    0: 'BEGINNING',
    1: 'FETCHING',
    2: 'PREPARING_ENVIRONMENT',
    3: 'RUNNING',
    4: 'ABORTED',
    5: 'FAILED',
    6: 'SUCCEEDED'
}
var STAGES_BY_NAME = {
    BEGINNING: 0,
    FETCHING: 1,
    PREPARING_ENVIRONMENT: 2,
    RUNNING: 3,
    ABORTED: 4,
    FAILED: 5,
    SUCCEEDED: 6
}

var Build = models.declare("Build", function(it, kind) {
    it.has.field("status", kind.string);
    it.has.field("signal", kind.string);
    it.has.field("error", kind.string);
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

    it.has.method('increment_field', function(name, value, callback){
        var self = this;

        var key = "clay:Build:id:" + self.__id__;
        var redis = self._meta.storage.connection;

        async.waterfall([
            function fetch(callback) {
                redis.hget(key, name, callback);
            },
            function update(current, callback) {
                var full = current + value;
                redis.hset(key, name, full, function(err){
                    callback(err, full, current, value);
                });
            }
        ], callback);
    });

    it.has.method('increment_stdout', function(value, callback){
        return this.increment_field("output", value, callback);
    });

    it.has.method('increment_stderr', function(value, callback){
        return this.increment_field("error", value, callback);
    });

    it.has.method('gravatar_of_size', function(size){
        var hash = crypto.createHash('md5');
        hash.update(this.author_email || '');
        return 'http://www.gravatar.com/avatar/' + hash.digest('hex') + '?s=' + size;
    });
    it.has.getter('succeeded', function() {
        return ((parseInt(this.status || 0) == 0) && this.signal === 'null');
    });
    it.has.getter('stage_name', function() {
        return (STAGES_BY_NAME[this.stage] || 'running').toLowerCase();
    });

    it.has.getter('duration', function() {
        var finished = moment(this.finished_at);
        return finished.fromNow()
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
                    process.kill(self.fetching_pid, signal);
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
                Build.fetch_by_key('clay:Build:id:' + id, callback);
            }
        ], callback);
    });
    it.has.class_method('fetch_by_id', function(id, callback) {
        var key = 'clay:Build:id:' + id;
        return this.fetch_by_key(key, function(err, build){
            if (err) {return callback(err);}

            var instruction_id = parseInt(build.instruction_id, 10);
            if (instruction_id < 0) {
                return callback(err, build);
            }
            BuildInstruction.fetch_by_id(instruction_id, function(err, instruction){
                if (err) {return callback(err);}
                build.instruction = instruction;
                return callback(err, build);
            });
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

        if (this.succeeded) {
            data.style_name = 'success';
        } else if (_.isString(data.message) && data.message.trim().length > 0) {
            data.style_name = 'failure';
        } else {
            data.style_name = this.stage_name.toLowerCase();
            data.message = data.style_name + " ...";
        }
        data.succeeded = JSON.parse(this.succeeded);
        data.stage_name = this.stage_name;
        data.route = "#build/" + data.__id__;
        data.permalink = settings.EMERALD_DOMAIN + "#build/" + data.__id__;
        data.started_at = this.started_at;
        data.finished_at = this.finished_at;
        data.is_building = parseInt(this.stage) < STAGES_BY_NAME.ABORTED;

        data.humanized = {
            "build_started": moment(this.build_started_at).fromNow(),
            "build_finished": moment(this.build_finished_at).fromNow(),
            "fetching_started": moment(this.fetching_started_at).fromNow(),
            "fetching_finished": moment(this.fetching_finished_at).fromNow()
        }
        if (_.isObject(this.instruction) && _.isFunction(this.instruction.toBackbone)) {
            data.instruction = this.instruction.toBackbone();
        }
        return data;
    });
});

var BuildInstruction = models.declare("BuildInstruction", function(it, kind) {
    it.has.field("name", kind.string);
    it.has.field("description", kind.string);
    it.has.field("repository_address", kind.string);
    it.has.field("branch", kind.string);
    it.has.field("build_script", kind.string);

    it.has.getter('last_build', function() {
        return this.all_builds[0];
    });
    it.has.getter('last_success', function() {
        return this.succeeded_builds[0];
    });
    it.has.getter('last_failure', function() {
        return this.failed_builds[0];
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
    it.has.method('toBackbone', function() {
        var self = this;
        var data = this.__data__;

        data.id = data.__id__;
        ['all_builds', 'succeeded_builds', 'failed_builds'].forEach(function(attribute){
            data[attribute] = self[attribute].map(function(b){ return b.toBackbone() });
        });
        data.is_building = self.is_building || false;
        data.current_build = self.current_build || null;

        return data;
    });
    it.has.class_method('fetch_by_id', function(id, callback) {
        var self = this;

        var redis = self._meta.storage.connection;

        async.waterfall([
            function fetch_instruction (callback){
                logger.debug('fetch_by_id: fetching raw data');
                return redis.hgetall('clay:BuildInstruction:id:' + id, callback);
            },
            function fetch_builds (data, callback){
                BuildInstruction.with_builds_from_data(data, callback);
            }
        ], callback);
    });

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
                    logger.handleException(err);
                    if (err) {return callback(null, all_builds, succeeded_builds, failed_builds);}
                    self.current_build = null;
                    self.is_building = false;

                    if (parseInt(current_build.instruction_id, 10) === self.__id__) {
                        self.is_building = true;
                        self.current_build = current_build;
                    }
                    callback(null, all_builds, succeeded_builds, failed_builds);
                });
            }
        ], function(err, all_builds, succeeded_builds, failed_builds){
            self.all_builds = all_builds;
            self.succeeded_builds = succeeded_builds;
            self.failed_builds = failed_builds;
            callback(err, self);
        });
    });
    it.has.method('run', function(current_build, lock) {
        var self = this;
        var Runner = require('./actors/buildrunner').BuildRunner;
        var r = new Runner(current_build, self);
        r.start();
        // var runner = child_process.fork(__dirname + '/actors/buildrunner.js');
        // current_build.pid = runner.pid;
        // current_build.save(function(err){
        //     if (err) {
        //         logger.handleException(err);
        //         logger.fail(err.stack);
        //         return lock.release();
        //     }
        //     runner.send({
        //         action: 'run',
        //         build_id: current_build.__id__,
        //         instruction_id: self.__id__
        //     });
        // });
    });
});

var default_storage = Build._meta.storage;

module.exports = {
    BuildInstruction: BuildInstruction,
    Build: Build,
    connection: default_storage.connection,
    storage: default_storage,
    clear_keys: function(pattern, callback) {
        var self = this;
        var pattern_list = (pattern instanceof Array) ? pattern: [pattern];
        var exception;
        var key_list = [];

        pattern_list.forEach(function(pattern){
            self.connection.keys(pattern, function(err, keys){
                if (err) {exception = err;return;}
                keys.forEach(function(key) {key_list.push(key);});

                if (pattern === pattern_list.last) {
                    self.connection.del(key_list ,function(err) {
                        return callback(exception, key_list);
                    });
                }
            });
        });
    },
    STAGES_BY_INDEX: STAGES_BY_INDEX,
    STAGES_BY_NAME: STAGES_BY_NAME
}
