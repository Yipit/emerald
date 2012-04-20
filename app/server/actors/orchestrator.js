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

var logger = new (require('../logger').Logger)("[ ORCHESTRATOR ]".red.bold);

module.exports.make = function(io) {
    var subscribe = require('redis').createClient();
    subscribe.setMaxListeners(0);
    subscribe.subscribe("BuildInstruction created");
    subscribe.subscribe("BuildInstruction edited");
    subscribe.subscribe("BuildInstruction enqueued");
    subscribe.subscribe("BuildInstruction deleted");

    subscribe.subscribe("Repository started fetching");
    subscribe.subscribe("Repository finished fetching");
    subscribe.subscribe("Repository being fetched");

    subscribe.subscribe("Repository started updating");
    subscribe.subscribe("Repository finished updating");

    subscribe.subscribe("Build started");
    subscribe.subscribe("Build finished");
    subscribe.subscribe("Build aborted");
    subscribe.subscribe("Build stdout");
    subscribe.subscribe("Build stderr");
    subscribe.subscribe("Build output");
    subscribe.subscribe("Build running");

    subscribe.subscribe("Pipeline created");
    subscribe.subscribe("Pipeline edited");
    subscribe.subscribe("Pipeline deleted");

    subscribe.subscribe("General error");

    io.sockets.on("connection", function(socket) {
        subscribe.on("message", function(channel, message) {
            var parsed;
            try {
                parsed = JSON.parse(message);
            } catch (e) {
                parsed = message;
            }
            socket.emit(channel, parsed);
            logger.debug(channel, message);
        });
    });
};
