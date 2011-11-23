var Table = require('cli-table');

desc('cleanse the db and populate the database with test data');
task('default', [], function () {
    var table = new Table({
        head: ['Model', 'Name', 'Error'],
        colWidths: [20, 30, 50]
    });

    var entity = require('./models');
    console.log("Populating the database...".bold.white);
    entity.redis.keys("clay*", function(err, keys){
        entity.redis.del(keys, function(){
            entity.User.create({
                name: "John Doe",
                email: "john@doe.com",
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
});

desc('run the unit tests');
task('unit', [], function () {
    console.log("unit has passed!");
});

desc('run the functional tests');
task('functional', [], function () {
    console.log("functional has passed!");
});
