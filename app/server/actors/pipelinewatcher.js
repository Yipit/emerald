/* Emerald - Continuous Integration server focused on real-time interactions
 *
 *   Copyright (C) 2012  Yipit Inc. <coders@yipit.com>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */


var async = require('async');
var dispatch = require('../command').dispatch;
var BuildInstruction = require('../models').BuildInstruction;
var Pipeline = require('../models').Pipeline;

function PipelineWatcher() {
    this.pipelines = {};
    this.redis = BuildInstruction._meta.storage.connection;
    this.pubsub = require('redis').createClient();

    var self = this;
    this.pubsub.subscribe("Build finished");
    this.pubsub.subscribe('Pipeline created');
    this.pubsub.subscribe('Pipeline deleted');
    this.pubsub.subscribe('Pipeline edited');
    this.pubsub.on('message', function (channel, message) {
        switch (channel) {
        case 'Pipeline created':
        case 'Pipeline edited':
        case 'Pipeline deleted':
            self.update_pipelines();
            break;
        case 'Build finished':
            self.build_next(JSON.parse(message));
            break;
        }
    });
}


PipelineWatcher.prototype.update_pipelines = function() {
    var self = this;

    /* Resetting the saved pipeline array, this function runs everytime
     * a pipeline is created, edited or removed and the code bellow fully
     * populates it again. */
    self.pipelines = [];

    Pipeline.fetch_all(function (err, pipelines) {
        pipelines.forEach(function (item) {
            /* First step: break the pipeline by its separator, a
             * pipe ("|") */
            var found = [];

            item.description.split('|').forEach(function (instruction) {
                found.push(instruction.trim());
            });

            /* Not handling a pipeline with a single element */
            if (found.length < 2) {
                return;
            }

            async.map(found, function (key, callback) {
                var reg = new RegExp("^" + key + "$");
                return BuildInstruction.find_by_name(reg, function (err, pipeline) {
                    return callback(null, pipeline);
                });
            }, function (err, items) {
                for (var i = 0; i < items.length - 1; i++) {
                    var current_instruction = items[i][0];
                    var next_instruction = items[i+1][0];
                    self.pipelines[current_instruction.__id__] =
                        next_instruction.__id__;
                }
            });
        });
    });
};


PipelineWatcher.prototype.build_next = function (message) {
    var id = this.pipelines[message.build.instruction_id];
    if (id === undefined || !message.build.succeeded) {
        return;
    }

    BuildInstruction.find_by_id(id, function (err, instruction) {
        instruction.run();
    });
};


PipelineWatcher.prototype.start = function () {
    this.update_pipelines();
};


exports.start = function() {
    (new PipelineWatcher()).start();
};
