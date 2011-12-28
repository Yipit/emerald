## this is a build server made to be real-time, fast and dead simple to use


# "hands on" hack guide

## install the dependencies

### 1. node v0.4.12
### 2. npm 1.0.103
### 3. redis... just make sure it's running
### 4. global dependencies

```
npm install -g jake vows nodemon
```

### 5. local dependencies

just run

```
npm install
```

*and should be enough to install all the dependencies in `package.json`

## run the tests!

our [Jakefile](https://github.com/Yipit/emerald/blob/master/Jakefile) is full of candy...

### unit tests
```
jake unit
```

### functional tests
```
jake functional
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

In order to make testing emerald locally much more fun, there are some fixtures available.
If you wanna make changes in it, simply add more entities to the `entities` array in [Jakefile](https://github.com/Yipit/emerald/blob/master/Jakefile):

```javascript
var entities = [
    new entity.User({
        name: "Gabriel Falcão",
        email: "gabriel@yipit.com",
        password: '123'
    }),
    ...

    /************************

    YOUR OWN ENTITIES HERE...

    ************************/

    ...
    new entity.Pipeline({
        name: "Emerald Tests",
        instructions: [{__id__: 1}, {__id__: 2}]
    })
];
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

## underscore

this lib is like a
[polyfill](http://remysharp.com/2010/10/08/what-is-a-polyfill/) for
manipulating javascript objects with shorthand functions.

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

![diagram](https://github.com/Yipit/emerald/raw/master/design/emerald.png)
