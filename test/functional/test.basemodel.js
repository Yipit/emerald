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

var clay = require('clay');

var EmeraldModel = require('../../app/server/models/base').EmeraldModel;

describe('EmeraldModel', function () {
    var Person = EmeraldModel.subclass('Person', function (it, kind) {
        it.has.field("name", kind.string);
        it.has.field("age", kind.numeric);
    });

    it('it returns instance data into a javascript object', function (done) {
        var lincoln = new Person({ name: 'Lincoln', age: 25 });
        lincoln.data().name.should.equal('Lincoln');
        lincoln.data().age.should.equal(25);

        var gabriel = new Person({ name: 'Gabriel', age: 24 });
        gabriel.data().name.should.equal('Gabriel');
        gabriel.data().age.should.equal(24);

        done();
    });

    it('it serializes data to json', function (done) {
        var lincoln = new Person({ name: 'Lincoln', age: 25 });
        lincoln.toString().should.equal('{"name":"Lincoln","age":25}');

        var gabriel = new Person({ name: 'Gabriel', age: 24 });
        gabriel.toString().should.equal('{"name":"Gabriel","age":24}');

        done();
    });

    it('provides a helper to set a field value', function (done) {
        var person = new Person({ name: 'Someone', age: 20 });

        // it must be someone's birth day! Let's increment his age
        person.set('age', person.age+1, function (err, field, value, instance) {
            instance.age.should.be.equal(21);
            done();
        });
    });

    it('helps the programmer to concat values on a string field', function (done) {
        var lincoln = new Person({ name: 'Lincoln', age: 25 });
        async.waterfall([
            function (callback) {
                lincoln.save(function (err) {
                    callback(err);
                });
            },
            function (callback) {
                lincoln.concat('name', ' de', callback);
            },
            function (full, current, piece, callback) {
                lincoln.concat('name', ' Sousa', callback);
            }
        ], function (err, current, full, callback) {
            lincoln.name.should.equal('Lincoln de Sousa');
            done();
        });
    }); 
});
