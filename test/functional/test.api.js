/* Emerald - Continuous Integration server focused on real-time interactions
 *
 *     Copyright (C) 2012  Yipit Inc. <coders@yipit.com>
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

/* This file describes some useful tests for our HTTP API, like listing,
 * creating, editing bulding structions and builds */

/* dependency list */
var should = require('should');
var request = require('request');

/* Shortcut to build API urls */
function api(method) {
    return 'http://localhost:3000/api/' + method + '.json';
}

/* First test, let's create a simple build instruction, just like the user API
 * should do it */

describe('BuildInstruction', function () {

    it('creates a new build instruction', function (done) {
        var data = {
            name: 'ratcursor',
            repository_address: 'git://github.com/clarete/ratcursor.git',
            branch: 'master',
            build_script: 'make'
        };

        request.post({
            url: api('instructions'),
            json: data
        }, function (error, response, body) {
            /* Sanity check, we should not continue if something happened */
            if (error) { return done(error); }

            /* First, test the status, and then let's check out the body */
            response.statusCode.should.equal(201, 'response should be "201 Created"');
            body.name.should.equal(data.name);
            body.repository_address.should.equal(data.repository_address);
            body.branch.should.equal(data.branch);
            body.build_script.should.equal(data.build_script);

            return done();
        });
    });


    it('lists created build instructions', function (done) {
        request.get({
            url: api('instructions'),
            'content-type': 'application/json'
        }, function (error, response, body) {
            /* Sanity check, we should not continue if something happened */
            if (error) { return done(error); }

            /* As usual, testing the response code */
            response.statusCode.should.equal(200, 'response should be "200 Success"');

            /* Listing the already created builds (currently, just one) */
            body = JSON.parse(body);
            body.length.should.equal(1);
            body[0].name.should.equal('ratcursor');
            return done();
        });
    });
});
