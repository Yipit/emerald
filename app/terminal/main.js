#!/usr/bin/env node

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

program.parse(process.argv);