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
task('default', [], function(pattern){
    run_tests('{unit,functional}', pattern);
});
desc('cleanse the db and populate the database with test data');
task('data', [], function () {
    var entity = require('./app/server/models');

    process.stdout.write("Populating the database... ".white.bold);
    console.time("Finished within");
    entity.clear_keys(["emerald*","clay*","sess*"], function(err, keys){
        if (err) {
            console.log("Failed:".red.bold, err.toString().yellow.bold);
            console.timeEnd("Finished within");
            process.exit((err && 1) || 0);
            return;
        }

        var entities = [
            new entity.BuildInstruction({
                name: "Emerald Unit Tests",
                description: "Asserting that basic business rules\nare working perfectly in emerald",
                repository_address: "git@github.com:Yipit/emerald.git",
                branch: "master",
                build_script: 'npm install\njake unit',
                author: {__id__: 1}
            }),
            new entity.BuildInstruction({
                name: "Yipit Unit Tests",
                description: "Tests emerald against redis",
                repository_address: "git@github.com:Yipit/yipit.git",
                branch: "master",
                build_script: './run-build-for unit'
            })
        ];
        entity.storage.persist(entities, function(err, items){
            if (err) {
                console.log("Failed:".red.bold, err.toString().yellow.bold);
            } else {
                console.log("OK".green.bold);
            }
            console.timeEnd("Finished within");
            process.exit((err && 1) || 0);
        });
    });
});

['unit', 'functional'].forEach(function (val, index, array){
    desc('run the ' + val + ' tests');
    task(val, [], function (pattern) { run_tests(val, pattern)});
});
