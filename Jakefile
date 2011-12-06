var util = require('util');
var child_process = require("child_process");
require("colors");
process.env['NODE_PATH'] = process.env['NODE_PATH'] + ':' + __dirname + '/../';


var run_tests = function(kind, pattern) {
    command = './node_modules/vows/bin/vows --spec spec/' + kind + '/' + (pattern || '') + '*';

    var test = child_process.exec(command, {env: process.env}, function(error, stdout, stderr) {
        console.log(stdout.toString());
        console.log(stderr.toString());
    });
    test.on('exit', function(code, signal) {
        process.on('exit', function () {
            process.reallyExit(code);
        });
    });
}

desc('');
task('default', [], function(){
  jake.Task['functional'].invoke();
});
desc('cleanse the db and populate the database with test data');
task('data', [], function () {
    var entity = require('./models');
    process.stdout.write("Populating the database... ".white.bold);
    console.time("Finished within");
    entity.clear_keys("clay*", function(err, keys){
        entity.clear_keys("sess*", function(err, keys){
            var entities = [
                new entity.User({
                    name: "Gabriel Falcão",
                    email: "gabriel@yipit.com",
                    password: '123'
                }),
                new entity.BuildInstruction({
                    name: "Emerald Unit Tests",
                    repository_address: "file://" + __dirname + "/.git",
                    build_script: 'jake unit',
                    author: {__id__: 1}
                }),
                new entity.BuildInstruction({
                    name: "Emerald Functional Tests",
                    repository_address: "file://" + __dirname + "/.git",
                    build_script: 'jake functional',
                    author: {__id__: 1}
                }),
                new entity.Pipeline({
                    name: "Emerald Tests",
                    instructions: [{__id__: 1}, {__id__: 2}]
                })
            ];
            entity.storage.persist(entities, function(err, items){
                if (err) {
                    console.log("Failed".red.bold);
                } else {
                    console.log("OK".green.bold);
                }
                console.timeEnd("Finished within");
                process.exit((err && 1) || 0);
            });
        });
    });
});

['unit', 'functional'].forEach(function (val, index, array){
    desc('run the ' + val + ' tests');
    task(val, [], function (pattern) { run_tests(val, pattern)});
});
