#!/usr/bin/env node

var program = require('commander');
var async = require('async');
var meta = require("../../package");

program
    .version(meta.version);

program
    .command('build <instruction-id>')
    .description('given an instruction id, creating a Build for it')
    .action(function(instruction_id){
        var entities = require("../server/models");
        var BuildRunner = require('../server/actors/buildrunner').BuildRunner;

        async.waterfall([
            function fetch_instruction(callback){
                console.log("Fetching Instruction #" + instruction_id);
                entities.BuildInstruction.fetch_by_id(instruction_id, callback);
            },
            function create_build(instruction, callback) {
                console.log("Creating a new build...");
                entities.Build.create({
                    error: "",
                    output: "",
                    signal: 'SIGKILL',
                    status: 1,
                    stage: entities.STAGES_BY_NAME.BEGINNING,
                    build_started_at: new Date(),
                    instruction_id: instruction_id
                }, function(err, key, build){
                    callback(err, build, instruction);
                });
            }
        ], function(err, build, instruction){
            if (err) {
                console.log(err.toString());
                console.log(err.stack.toString());
                return;
            }
            var runner = new BuildRunner(build, instruction);
            runner.start();
        });

    });

program.parse(process.argv);