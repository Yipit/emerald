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
jake test
```

## run the server!

```
nodemon app.js
```
