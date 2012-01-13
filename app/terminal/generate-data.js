/***************************************************************************
Emerald - Continuous Integration server focused on real-time interactions
Copyright (C) <2012>  Gabriel Falcão <gabriel@yipit.com>
Copyright (C) <2012>  Yipit Inc. <coders@yipit.com>

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
 ***************************************************************************/
require("colors");

var entity = require('../server/models');
var settings = require('../../settings');

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
            name: "This passes",
            description: "green and fast :)",
            repository_address: "file://" + settings.LOCAL_FILE('.git'),
            branch: "master",
            build_script: 'make unit',
            author: {__id__: 1}
        }),
        new entity.BuildInstruction({
            name: "Fails miserably",
            description: "red and fast :(",
            repository_address: "file://" + settings.LOCAL_FILE('.git'),
            branch: "master",
            build_script: 'ls "forcing a failure"',
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
