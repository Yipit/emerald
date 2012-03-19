## this is a build server made to be real-time, fast and dead simple to use. In other words, this was made to be cool :)

# installation

## install node.js

I recommend using the
[node version manager](https://github.com/creationix/nvm) so that you
can have as many node.js versions you want and switch among them
pretty easily.

### if you don't have node.js and npm installed already, run the commands below:

```console
git clone git://github.com/creationix/nvm.git ~/.nvm
echo 'source $HOME/.nvm/nvm.sh' >> $HOME/.bash_profile
. $HOME/.nvm/nvm.sh
```

the snippet above must be run only once, but the one below you can do as many times you want

```console
nvm install v0.6.10
nvm use v0.6.10
nvm alias default v0.6.10
```

## install redis

### MacOSX

`$ brew install redis`

### Ubuntu and other Debian-ish GNU/Linux distros

`$ sudo apt-get install redis-server`

### Windows

Forget it, bro. This CI server is cool, so it will NOT run on
windows. Sorry about that :)

## install emerald

`$ npm install -g emerald`

# running it

`$ emerald run`

## other options

you can pass the `-s` or `--settings` parameter to the `emerald` command line parameter, this will cause emerald to import the settings from the file and merge them over the [default settings](https://github.com/Yipit/emerald/blob/master/settings.js)

below is a full description of all the options, if you want to write
your own settings file, you can pretty much copy and paste the code
below and add your own fine tune:

please consider `$EMERALD_ROOT$` as the path that [npm](http://npmjs.org/) installed emerald for you when you ran `npm install -g emerald`

```javascript
module.exports = {
    LOG_LEVEL: 3, /* refer to log levels in the README */
    SHUT_UP: false, /* when true emerald will produce absolutely NO logging output. It is used internally when emerald needs to run functional tests against the builtin server */
    GIT_POLL_INTERVAL: 3000, /* 60.000 miliseconds = 1 second */
    EMERALD_PORT: 3000,
    EMERALD_HOSTNAME: 'localhost',
    EMERALD_DOMAIN: 'http://localhost:3000', /* used internally to prefix links */
    REDIS_KEYS: {
        current_build: "emerald:current-build", /* the key that will hold the current build */
        build_queue: "emerald:build-queue" /* the key that will hold the build queue */
    },
    EMERALD_PATH: "~/.emerald", /* where emerald will store builds and metadata */
    SANDBOX_PATH: "~/.emerald/builds", /* the folder where emerald will store its builds, it can be set through the environment variable EMERALD_SANDBOX_PATH */
    ASSETS_PATH: "$EMERALD_ROOT$/public"
    LOCAL_FILE: function(...){}, /* please NEVER overwrite this function, it is used internally and you don't wanna mess up with that. Word. */
    VIEW_PATH: "$EMERALD_ROOT$/public/app/server/html", /* where emerald will search for swig templates */
    CLIENT_PATH: "$EMERALD_ROOT$/app/client", /* the path where the backbone part of emerald is implemented */
    BACKBONE_VIEW_PATH: "$EMERALD_ROOT$/app/client/html", /* where emerald will search for backbone view templates */
    SCRIPT_PATH: "$EMERALD_ROOT$/app/terminal/main.js", /* the path for the emerald CLI, you won't need to change it. Please don't even try :) */
    PID_PATH: PID_PATH, /* fullpath for the PIDFILE that emerald will use when running as a daemon */
    STDOUT_PATH: STDOUT_PATH, /* fullpath for the STDOUT file that emerald will write when running as a daemon */
    STDERR_PATH: STDERR_PATH  /* fullpath for the STDERR file that emerald will write when running as a daemon */
}
```


# "hands on" hack guide

## install the dependencies

### 1. node v0.6.10
### 2. npm 1.1.0-3
### 3. redis... just make sure it's running
### 4. global dependencies

```console
npm install -g vows jshint
```

### 5. local dependencies

just run

```console
npm install
```

*and should be enough to install all the dependencies in `package.json`

## set up the pre-commit hook:

```console
cd path/to/emerald
```
```console
ln -s .development/pre-commit-hook .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

this is the result of activating the pre-commit hook:
![your commits are gonna be pretty](http://f.cl.ly/items/1b162c0A1V0o2M0K1O1n/Screen%20Shot%202012-02-09%20at%205.58.43%20PM.png)

## run the tests!

### unit tests
```console
make unit
```

### functional tests
```console
make functional
```

### or... run them all together
```console
npm test
```

## run the server!

```console
npm start
```

## fixtures for testing locally

```console
make data
```

# Dependencies and its explanations

## clay.js

It's our persistency layer on redis, this lib an active record by
[Yipit.com](http://yipit.com) you can see
[its documentation at github](http://github.com/Yipit/clay.js)

## redis

Mostly used for pub/sub and queue management, and *connect-redis*
sessions, although we also explicitly declare it as the first
connection in our models

[clay.js](http://github.com/Yipit/clay.js) configuration.

* [github](http://github.com/Yipit/clay.js)

## express / socket.io / connect-redis

The web layer: [express](http://github.com/visionmedia/express) is the
webserver, [socket.io](http://socket.io), in turn, is for real-time pushes to the clients. [Connect-redis](https://github.com/visionmedia/connect-redis) is a redis-backed session storage for express.

## jade / less

[Jade](http://github.com/visionmedia/jade) is a beautiful and
shorthand template language, and [less](http://lesscss.org/) a
shorthand styling language that has powers beyond just CSS.

## underscore.js

this lib is like a
[polyfill](http://remysharp.com/2010/10/08/what-is-a-polyfill/) for
manipulating javascript objects with shorthand functions.

## backbone.js

This awesome library allows us to organize the web app a lot better by
providing MVC support on the client side.  It doesn't mean all our
client-side models are persisted on the server, they just leverage how
the views should update themselves.

## async

it's our flow-control library. Helps avoiding too much callback soup
in our code.

* [github](https://github.com/caolan/async)

## colors / mkdirp

[colors](https://github.com/Marak/colors.js) helps us making the
terminal feedback less boring by logging with color-formated
output. [mkdirp](https://github.com/substack/node-mkdirp) is just for
creating directories recursively.

## testing: vows and should

if you want to hack on emerald's code, then you're gonna need [vows](http://vowsjs.org/) in order to run the tests which are written under the [DSL](http://en.wikipedia.org/wiki/Domain-specific_language) provided by [should.js](https://github.com/visionmedia/should.js)
# sketch of how this should work:

![diagram](https://github.com/Yipit/emerald/raw/master/resources/design/emerald.png)

<a name="architecture" />
## a little more detailed description:

### Server actors

As you can notice Emerald's compound has not only a HTTP server but
also a few workers that runs in parallel to it:

#### Orchestrator

This guy subscribes to a set of meaningful signals sent to the redis
pub/sub, deserializes it into JSON objects and broadcasts to all the
socket.io connected clients.

In other words it captures all the server-side events and send to the
connected clients so that the UI can be updated in real time.

#### Queue consumer

It's basically a structured callback passed to `setInterval` with the
`settings.GIT_POLL_INTERVAL` as the interval param.  So it sits there
checking if there is a build already running, if not it gets the next
instruction id to be build from the queue (if any instructions there)
and spawns a Build Runner for that given instruction

The build queue is to a redis
[`SortedSet`](http://redis.io/commands#sorted_set) in which the key is
`emerald:build-queue` by default, but can be configured through
settings.js

The Build Runner also sets a lock in Redis so that it doesn't run
parallel builds, avoiding builds to violate each other's environment.
After a build is finished it unsets the lock (key `emerald:current-build`)

If the queue is locked, then it just yields by doing nothing :D

#### Build Runner

Is an object that is instantiated with a models.Build() object as parameter, the it actually do build-related stuff:

1. git clone/pull
2. run the build script
3. send the appropriate events to the redis pub/sub (i.e: `BuildInstruction enqueued`, `BuildInstruction created`, `Repository being fetched`, [so on...](https://github.com/Yipit/emerald/blob/master/app/server/actors/orchestrator.js#L6))

At this point you are probably asking yourself how can the Build Runner possibly take a build as instance since the runner is supposed to create it itself. [Just take a look here](https://github.com/Yipit/emerald/blob/master/app/server/models.js#L458) and you will see that `server.models.BuildInstruction` instances have a `run` method that [gets called by the queue consumer](https://github.com/Yipit/emerald/blob/master/app/server/actors/queueconsumer.js#L81)

### Server-side events are sent to the clients

Since emerald was built with "real-time UI" in mind, its architecture
is all event-based.

In other words the server actors publish events to the redis pub/sub,
those events have JSON metadata serialized into it, so that the
orchestrator sends those events to the socket.io clients which
[translates the events into Backbone model instances events](https://github.com/Yipit/emerald/blob/master/app/client/models.js#L47).

This is basically how emerald's user interface looks like it's alive :D

Those are the current events that are [handled by socket.io](https://github.com/Yipit/emerald/blob/master/app/client/websockets.js):

* `BuildInstruction created`
* `BuildInstruction edited`
* `BuildInstruction enqueued`
* `BuildInstruction deleted`
* `Repository started fetching`
* `Repository finished fetching`
* `Repository being fetched`
* `Build started`
* `Build finished`
* `Build aborted`
* `Build stdout`
* `Build stderr`
* `Build output`
* `Build running`
* `General error`


# license

Emerald is released under [GNU Affero General Public License version 3](http://www.gnu.org/licenses/agpl.html)

```
This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
```
