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

var should = require('should');
var mock = require('nodemock').mock;
var injectr = require('injectr');

var git = injectr('app/server/actors/common/git.js', {
    child_process: mock("spawn").takes("git")
});

describe('Git interaction', function () {
    describe('#Clone', function (done) {
        it('should start and timeout after X seconds', function (done) {
            var clone = new git.Clone({
                uri: 'git@github.com/Yipit/emerald.git',
                path: '/tmp',
                timeout: 1,
                killfunc: function(pid, signal) {
                    signal.should.equal('SIGKILL');
                    done();
                }
            });
            clone.start();
        });
    });
});
