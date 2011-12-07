require("colors");
var entity = require("./models");
var GIT_POLL_INTERVAL = 5000; /* 60.000 miliseconds = 1 second */

exports.start = function(app, io, redis){
    app.get('/', function(request, response){
        response.show('index');
    });
    app.get('/logout', function(request, response){
        request.session.user_id = null;
        response.redirect(request.param('next', '/'));
    });
    app.all('/login', function(request, response){
        if (request.method === "POST") {
            entity.User.authenticate(request.param('email'), request.param('password'), function(err, user) {
                if (!err) {
                    request.session.user_id = user.__id__;
                    response.redirect(request.param('next', '/'));
                } else {
                    console.log(err)
                    return response.show('login', {error: err});
                }
            });
        } else {
            return response.show('login', {error: null});
        }
    });

    app.all('/users', function(request, response){
        switch (request.method) {
            case "GET":
                entity.User.all(function(err, users){
                    response.show('manage-users', {users: users, has_users: users.length > 0});
                });
            break;
            case "POST":
                var naive = new entity.User({
                    name: request.param('name'),
                    email: request.param('email'),
                    password: request.param('password')
                });
                naive.save(function(err, key, instruction) {
                    response.redirect('/user/' + instruction.__id__)
                });
            break;
            default:
                response.send('method not allowed', 405);
            break;
        }
    })
    app.get('/user/:id', function(request, response){
        var id = parseInt(request.param('id'));
        entity.BuildInstruction.find_by_id(id, function(err, instruction) {
            response.show('instruction', {
                instruction: instruction
            });
        });
    });

    app.all('/instructions', function(request, response){
        switch (request.method) {
            case "GET":
                entity.BuildInstruction.all(function(err, instructions){
                    response.show('manage-instructions', {instructions: instructions, has_instructions: instructions.length > 0});
                });
            break;
            case "POST":
                var naive = new entity.BuildInstruction({
                    name: request.param('name'),
                    description: request.param('description'),
                    repository_address: request.param('repository_address'),
                    build_script: request.param('build_script')
                });
                naive.save(function(err, key, instruction) {
                    response.redirect('/instruction/' + instruction.__id__)
                });
            break;
            default:
                response.send('method not allowed', 405);
            break;
        }
    })
    app.get('/instruction/:id', function(request, response){
        var id = parseInt(request.param('id'));
        entity.BuildInstruction.find_by_id(id, function(err, instruction) {
            response.show('instruction', {
                instruction: instruction
            });
        });
    });

    app.get('/settings', function(request, response){
        response.show('settings');
    });
    app.get('/plugins', function(request, response){
        response.show('plugins');
    });
    app.get('/profile', function(request, response){
        response.show('profile');
    });

    io.sockets.on('connection', function (socket) {
        socket.emit('connected');
        socket.on('delete BuildInstruction', function (data) {
            entity.BuildInstruction.find_by_id(parseInt(data.id), function(err, instruction){
                instruction.delete(function(){
                    socket.broadcast.emit('BuildInstruction deleted', {id: instruction.__id__});
                });
            });
        });
        socket.on('delete User', function (data) {
            entity.User.find_by_id(parseInt(data.id), function(err, instruction){
                instruction.delete(function(){
                    socket.broadcast.emit('User deleted', {id: instruction.__id__});
                });
            });
        });
    });

    var git_poller = new GitPoller(redis, app);
    git_poller.start();

}


function GitPoller(redis, app, options) {
    options = options || {
        debug: false,
        interval: GIT_POLL_INTERVAL
    };
    options.debug = options.debug || false;
    options.interval = options.interval || GIT_POLL_INTERVAL;

    this.interval = options.interval;
    this.redis = redis;
    this.lock = new BuildLock({redis:redis});
    this.app = app;
    this.debug = options.debug;
    this.loop = null;
    this.keys = {
        current_build: "emerald:current-build",
        build_queue: "emerald:build-queue"
    };
}
GitPoller.prototype.stop = function(){
    /* stopping the interval */
    this.loop && clearInterval(this.loop);
    this.redis.publish("emerald:GitPoller:stop");
}
var loglevel = {
    DEBUG: 4,
    SUCCESS: 3,
    INFO: 2,
    FAIL: 1,
    CRITICAL: 0
}

GitPoller.prototype.log = new Logger(loglevel.DEBUG);

function Logger (level) {
    level = level || loglevel.SUCCESS;

    this.prefix = "   [EMERALD]".green + " GIT Poller -".green.bold;

    this.info = function(parts) {
        if (level < 2) return;
        var msg = (parts instanceof Array) && parts.join(" ") || parts;
        console.log(this.prefix, "INFO:".cyan.bold, msg, "@", this.timestamp());
    },
    this.debug =  function(parts) {
        if (level < 4) return;
        var msg = (parts instanceof Array) && parts.join(" ") || parts;
        console.log(this.prefix, "DEBUG:".yellow.bold, msg, "@", this.timestamp());
    },
    this.success =  function(parts) {
        if (level < 3) return;
        var msg = (parts instanceof Array) && parts.join(" ") || parts;
        console.log(this.prefix, msg.green.bold, "@", this.timestamp());
    },
    this.fail = function(parts) {
        if (level < 1) return;
        var msg = (parts instanceof Array) && parts.join(" ") || parts;
        console.log(this.prefix, msg.red.bold, "@", this.timestamp());
    },
    this.timestamp = function(){
        return (new Date()).toTimeString().yellow.bold;
    }
}
GitPoller.prototype.start = function(){
    var self = this;

    var seconds = (parseFloat(GIT_POLL_INTERVAL) / 1000);

    self.log.info(["running with an interval of", seconds, seconds == 1 ? "second" : "seconds"]);

    /* lets start the loop and save the handler for later*/
    this.loop = setInterval(function(){
        /* see if there is a build runnning already */
        console.log("             --------------------------------------------------------------------------------".white.bold);
        self.redis.get(self.keys.current_build, function(err, data){
            self.log.debug("redis.get('"+self.keys.current_build+"')", arguments);
            var current_build = JSON.parse(data);
            /* if not building, let's quit and wait for the next interval */
            if (current_build) {
                self.log.info("already building:", current_build);
                return;
            }
            self.log.info("no builds running, checking the queue");
            /* since it is not building anything, lets get the first build to be runned */
            self.redis.zrange(self.keys.build_queue, 0, 1, function(err, items) {
                self.log.debug("redis.zrange('"+self.keys.current_build+"', 0, 1)", arguments);
                /* if there is nothing to run, let's quit and wait for the next interval */
                if (items.length === 0) {
                    self.log.info("nothing to build so far");
                    return;
                }
                var instruction_id_to_get = items.first;
                entity.BuildInstruction.find_by_id(instruction_id_to_get, function(err, instruction_to_run) {
                    if (err) {
                        self.log.fail(['could not find BuildInstruction with id', instruction_id_to_get, err.toString()]);
                        return; /* release lock */
                    }

                    var current_build = new entity.Build({instruction: instruction_to_run, output: "", error: ""});

                    self.redis.set(self.keys.current_build, current_build.__data__, function(err) {
                        self.log.debug("redis.set('"+self.keys.current_build+"', "+JSON.stringify(current_build.__data__)+")", arguments);
                        if (err) {
                            self.log.fail(['could not set the key', self.keys.current_build, 'to true (redis)', err.toString()]);
                            return; /* release lock */
                        }

                        /* no errors so far, let's remove it from the queue and build */
                        self.redis.zrem(instruction_id_to_get, function(){
                            self.log.debug("redis.zrem("+instruction_id_to_get+")", arguments);
                            instruction_to_run.run(self, current_build);
                        });
                    });
                });
            });

        });
    }, self.interval);
}
function BuildLock(options){}