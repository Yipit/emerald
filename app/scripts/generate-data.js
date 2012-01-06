require("colors");

var entity = require('../server/models');

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
