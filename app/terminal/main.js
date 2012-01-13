#!/usr/bin/env node
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

var program = require('commander');
var async = require('async');
var meta = require("../../package");

program
    .version(meta.version);

program
    .command('build <build-id>')
    .description('given a build id, runs it if never ran before')
    .action(function(build_id) {
        var entities = require("../server/models");
        var BuildRunner = require('../server/actors/buildrunner').BuildRunner;

        entities.Build.fetch_by_id(build_id, function(err, build){
            if (err) {
                console.log(err.toString());
                console.log(err.stack.toString());
                return;
            }
            var runner = new BuildRunner(build);
            runner.start();
        });
    });

program
    .command('run')
    .description('runs emerald')
    .action(function(build_id) {
        var emerald = require('../server/main')
        emerald.run()
    });

program.parse(process.argv);
