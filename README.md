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

# sketch of how this should work:

![diagram](https://github.com/Yipit/emerald/raw/master/design/emerald.png)
