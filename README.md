## this is a build server made to be real-time, fast and dead simple to use


# "hands on" hack guide

## install the dependencies

### 1. node v0.4.12
### 2. npm 1.0.103
### 3. redis... just make sure it's running
### 4. global dependencies

```
npm install -g vows
```

### 5. local dependencies

just run

```
npm install
```

*and should be enough to install all the dependencies in `package.json`

## run the tests!

### unit tests
```
make unit
```

### functional tests
```
make functional
```

### or... run them all together
```
npm test
```

## run the server!

```
npm start
```

## fixtures for testing locally

```
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

# license

Emerald is released under [GNU Affero General Public License version 3](http://www.gnu.org/licenses/agpl.html)

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
