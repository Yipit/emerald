var vows = require('vows')
, should = require('should')
, _ = require('underscore')._;

var entity = require('../../models');

vows.describe('A User').addBatch({
    'has a static method for authentication': function(){
        entity.User.should.respondTo('authenticate');
    },
    'Given there are two users in the database': {
        topic: function() {
            var topic = this;

            entity.clear_keys('clay:*', function(err, keys) {
                entity.User.create({
                    name: "John Doe",
                    email: "john@doe.com",
                    password: 'island',
                }, function(err, key, user1){
                    entity.User.create({
                        name: "Foo Bar",
                        email: "foo@bar.com",
                        password: 'baz',
                    }, function(err, key, user2){
                        topic.callback(err, user1, user2);
                    });
                });
            });
        },
        '\n  When an authetication is attempted with a wrong email': {
            topic: function(err, user1, user2) {
                var topic = this;
                entity.User.authenticate("let@me.in", "123", function(err){
                    topic.callback(null, err, user1, user2);
                });
            },
            'Then the callback is called with the right message': function(e, error) {
                error.message.should.be.equal('there are no users matching the email "let@me.in"');
            }
        },
        '\n  When an authetication is attempted with a wrong password': {
            topic: function(err, user1, user2) {
                var topic = this;
                entity.User.authenticate("john@doe.com", "123", function(err){
                    topic.callback(null, err, user1, user2);
                });
            },
            'Then the callback is called with the right message': function(e, error) {
                error.message.should.be.equal('wrong password for the login "john@doe.com"');
            }
        },
        '\n  When an authetication is attempted with right email and password': {
            topic: function(err, user1, user2) {
                entity.User.authenticate("john@doe.com", "island", this.callback);
            },
            'It should be authenticated': function(err, user) {
                should.exist(user);
                user.name.should.equal('John Doe');
                user.email.should.equal('john@doe.com');
            }
        }

    }
}).export(module);
