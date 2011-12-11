var vows = require('vows')
, should = require('should')
, crypto = require('crypto')
, _ = require('underscore')._;
require('colors');

var lib = require('../../gitpoller');
lib.logger.level = 0;

vows.describe('A *Lock* for GitPoller'.cyan).addBatch({
    'Takes a key string as 1st parameter redis instance as *2nd*, then:': {
        topic: function(){
            var redis_mock = {};
            var lock = new lib.PollerLock("some-key", redis_mock);

            this.callback(lock, redis_mock);
        },
        '*lock.key* is the same passed as constructor 1st arg': function(lock, redis_mock) {
            lock.key.should.equal("some-key");
        },

        '*lock.redis* should be the same object passed as first argument': function(lock, redis_mock) {
            lock.redis.should.equal(redis_mock);
        },
        '*lock.locked* starts as false': function(lock, redis_mock) {
            lock.locked.should.equal(false);
        }
    },
    '*lock.release* takes a callback that is *not* called if nothing was released and there is no error': function() {
        var redis_mock = {
            del: function(key, callback){
                key.should.equal('damn#key');
                callback(null, "0");
            }
        }
        var lock = new lib.PollerLock("damn#key", redis_mock);
        var called = false;
        lock.release(function(){
            called = true;
        });
        called.should.be.false;
    },
    '*lock.release* takes a callback that is *not* called if an error was produced': function() {
        var redis_mock = {
            del: function(key, callback){
                key.should.equal('damn#key');
                callback(new Error("LOLOLOLOL"), "0");
            }
        }
        var lock = new lib.PollerLock("damn#key", redis_mock);
        var called = false;
        lock.release(function(){
            called = true;
        });
        called.should.be.false;
    },
    '*lock.release* takes a callback that *is called* if there are no errors and at least 1 item was affected': function() {
        var redis_mock = {
            del: function(key, callback){
                key.should.equal('damn#key');
                callback(null, "1");
            }
        }
        var lock = new lib.PollerLock("damn#key", redis_mock);
        var called = false;
        lock.release(function(when){
            called = true;
            when.should.be.an.instanceof(Date);
        });
        called.should.be.true;
    },
    '*lock.acquire* gets from redis when *redis.get(key)* returns value': {
        topic: function(){
            var redis_mock = {
                get: function(key, callback){
                    key.should.equal('nice#key');
                    callback(null, {});
                }
            }
            var lock = new lib.PollerLock("nice#key", redis_mock);

            this.callback(lock, redis_mock);
        },
        'exits right away if has data': function(lock, redis){
            lock.acquire(function(){
                throw new Error("should not reach here!");
            });
        }
    },
    '*lock.acquire* gets from redis when *redis.get(key)* returns null': {
        topic: function(){
            var redis_mock = {
                get: function(key, callback){
                    key.should.equal('other#key');
                    callback(null, null);
                },
                set: function(key, value, callback){
                    key.should.equal('other#key');
                    value.should.equal('my locking value');
                    callback(null);
                }
            }
            var lock = new lib.PollerLock("other#key", redis_mock);

            this.callback(lock, redis_mock);
        },
        'the callback gets a *LockHandle* instance as parameter': function(lock, redis){
            lock.acquire(function(handle){
                should.exist(handle);
                handle.should.be.an.instanceof(lib.LockHandle);
            });
        },
        'Then calling *handle.lock* calls the callback': function(lock, redis){
            var called = false;
            lock.acquire(function(handle){
                handle.lock("my locking value", function(){
                    arguments.length.should.equal(0);
                    called = true;
                });
            });

            called.should.be.true;
        },
        '*.release()* is also available from the *handle*': function(lock, redis){
            lock.acquire(function(handle){
                should.exist(handle.release);
                var called = false;
                lock.release = function(a, b, c){
                    a.should.equal("foo");
                    b.should.equal(2);
                    c.should.equal("BAR");
                    called = true;
                }
                called.should.be.false;
                handle.release("foo", 2, "BAR")
                called.should.be.true;
            });
        },

    },
    '*lock.acquire* behavior when *redis.set* got an error': {
        topic: function(){
            var redis_mock = {
                get: function(key, callback){
                    key.should.equal('other#key');
                    callback(null, null);
                },
                set: function(key, value, callback){
                    key.should.equal('other#key');
                    value.should.equal('my locking value');
                    callback(new Error("something bad"));
                },
                del: function(){}
            }
            var lock = new lib.PollerLock("other#key", redis_mock);

            this.callback(lock, redis_mock);
        },
        'Then calling *handle.lock* will not call the callback': function(lock, redis){
            var called = false;
            lock.acquire(function(handle){
                handle.lock("my locking value", function(){
                    called = true;
                });
            });

            called.should.be.false;
        },
        'And calling *handle.lock* will cause the lock to be released': function(lock, redis){
            var released = false;
            lock.release = function(){
                released = true;
            }

            lock.acquire(function(handle){
                handle.lock("my locking value", function(){
                    released = false;
                });
            });
            released.should.be.true;
        }

    }
}).export(module);

vows.describe("A Poller's *Lifecycle*".cyan).addBatch({
    'Takes a redis instance as first parameter, then:': {
        topic: function(){
            var redis_mock = {};

            var lock_mock = {
                redis: redis_mock,
                acquire: function(){}
            };
            var lifecycle = new lib.Lifecycle("the_build#queue-key", lock_mock);

            this.callback(lifecycle, lock_mock, redis_mock);
        },
        '*lifecycle.key_for_build_queue* should be the same object passed as 1st argument': function(lifecycle, lock_mock) {
            lifecycle.key_for_build_queue.should.equal("the_build#queue-key");
        },
        '*lifecycle.lock* should be the same object passed as 2nd argument': function(lifecycle, lock_mock) {
            lifecycle.lock.should.equal(lock_mock);
        },
        '*lifecycle.consume_build_queue* should do nothing when the lock was not acquired': function(lifecycle, lock_mock){
            var called = false;

            lifecycle.consume_build_queue(function(){
                called = true;
            });
            called.should.be.false;
        }
    },
    '*lifecycle.consume_build_queue* should do nothing when there is an error getting the list from redis': function(){
        var called = false;
        var redis_zrange_called = false;
        var lock_was_released = false;

        var handle_mock = {
            release: function(cb){
                lock_was_released = true;
            }
        }
        var lock_mock = {
            redis: {
              zrange: function(key, start, end, callback){
                  redis_zrange_called = true;
                  start.should.equal(0);
                  end.should.equal(1);
                  callback(new Error('ooops'), [1]);
                }
            },
            acquire: function(callback){callback(handle_mock);}
        };

        var lifecycle = new lib.Lifecycle("the_build#queue-key", lock_mock);

        lifecycle.consume_build_queue(function(){
            called = true;
        });
        called.should.be.false;
        lock_was_released.should.be.true;
        redis_zrange_called.should.be.true;
    },
    '*lifecycle.consume_build_queue* should do nothing when there are no builds queued': function(){
        var called = false;
        var redis_zrange_called = false;
        var lock_was_released = false;

        var handle_mock = {
            release: function(cb){
                lock_was_released = true;
            }
        }
        var lock_mock = {
            redis: {
              zrange: function(key, start, end, callback){
                  redis_zrange_called = true;
                  start.should.equal(0);
                  end.should.equal(1);
                  callback(null, []);
                }
            },
            acquire: function(callback){callback(handle_mock);}
        };

        var lifecycle = new lib.Lifecycle("the_build#queue-key", lock_mock);

        lifecycle.consume_build_queue(function(){
            called = true;
        });
        called.should.be.false;
        lock_was_released.should.be.true;
        redis_zrange_called.should.be.true;
    },
    '*lifecycle.consume_build_queue* calls its callback with the next item to be consumed and the lock handle': function(){
        var called = false;

        var dummy_handle = {}
        var lock_mock = {
            redis: {
              zrange: function(key, start, end, callback){
                  callback(null, ["1st#instruction2run"]);
              }
            },
            acquire: function(callback){callback(dummy_handle);}
        };

        var lifecycle = new lib.Lifecycle("the_build#queue-key", lock_mock);

        lifecycle.consume_build_queue(function(){
            called = true;
        });

        called.should.be.true;
    }
}).export(module);

vows.describe('*The* Git Poller'.cyan).addBatch({
    'Takes a redis instance as first parameter, then:': {
        topic: function(){
            var redis_mock = {};
            var poller = new lib.GitPoller(redis_mock);

            this.callback(poller, redis_mock);
        },
        '*poller.redis* should be the same object passed as first argument': function(poller, redis_mock) {
            poller.redis.should.equal(redis_mock);
        },
        '*poller.loop* should be null': function(poller, redis_mock) {
            should.not.exist(poller.loop);
        }
    }
}).export(module);