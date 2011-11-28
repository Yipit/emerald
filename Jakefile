var Table = require('cli-table');
var child_process = require("child_process");

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
    var table = new Table({
        head: ['Model', 'Name', 'Error'],
        colWidths: [20, 30, 50]
    });

    var entity = require('./models');
    console.log("Populating the database...".bold.white);
    entity.clear_keys("clay*", function(err, keys){
        entity.User.create({
            name: "Gabriel Falcão",
            email: "gabriel@yipit.com",
            password: '123',
        }, function(err, key, john){
            table.push(["User", john.name, err || "none"])
            entity.BuildInstruction.create({
                name: "Emerald Unit Tests",
                repository_address: "file://" + __dirname + "/.git",
                build_script: 'jake unit',
                author: john
            }, function(err, key, instruction1){
                table.push(["BuildInstruction", instruction1.name, err || "none"])
                entity.BuildInstruction.create({
                    name: "Emerald Functional Tests",
                    repository_address: "file://" + __dirname + "/.git",
                    build_script: 'jake functional',
                    author: john
                }, function(err, key, instruction2){
                    table.push(["BuildInstruction", instruction2.name, err || "none"])
                    entity.Pipeline.create({
                        name: "Emerald Tests",
                        instructions: [instruction1, instruction2]
                    }, function(err, key, pipeline){
                        table.push(["Pipeline", pipeline.name, err || "none"])
                        console.log(table.toString());
                        process.exit(0);
                    });
                });
            });
        });
    });
});

['unit', 'functional'].forEach(function (val, index, array){
    desc('run the ' + val + ' tests');
    task(val, [], function (pattern) { run_tests(val, pattern)});
});
