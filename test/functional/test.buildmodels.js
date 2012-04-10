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

var should = require('should');
var async = require('async');
var utils = require('./utils');

var Build = require('../../app/server/models/build').Build;
var BuildInstruction = require('../../app/server/models/buildinstruction').BuildInstruction;

describe('The base models that registers repos and how to build them', function () {
    beforeEach(utils.clear_redis);

    it('should be able to create new build instructions', function (done) {
        BuildInstruction.create({
            name: "Let's make some tests go green",
            description: "Nothing else metters",
            repository_address: "git@github.com/blah.git",
            build_script: "python setup.py test",
            poll_interval: 0,
            max_build_time: 0
        }, function (err, key, instance) {
            instance.name.should.equal("Let's make some tests go green");
            instance.build_script.should.equal("python setup.py test");
            done();
        });
    });

    it('should, after being created, have the build lists empty', function (done) {
        async.waterfall([
            function Given_that_I_created_a_new_buildinstruction(callback) {
                BuildInstruction.create({
                    name: "Let's make some tests go green",
                    description: "Nothing else metters",
                    repository_address: "git@github.com/blah.git",
                    build_script: "python setup.py test",
                    poll_interval: 0,
                    max_build_time: 0
                }, callback);
            },
            function It_should_have_its_build_list_empty(key,
                                                         instance,
                                                         storage,
                                                         connection,
                                                         callback) {
                instance.get_all_builds(function (err, list) {
                    should.deepEqual(list, []);
                    callback(err, key, instance);
                });
            },
            function It_also_should_have_its_succeeded_list_empty(key, instance, callback) {
                instance.get_succeeded_builds(function (err, list) {
                    should.deepEqual(list, []);
                    callback(err, key, instance);
                });
            },
            function It_also_should_have_its_failed_list_empty(key, instance, callback) {
                instance.get_failed_builds(function (err, list) {
                    should.deepEqual(list, []);
                    callback(err);
                });
            }
        ], function (err) {
            done(err);
        });
    });
});
