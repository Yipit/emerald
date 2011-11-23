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
                error.message.should.be.equal('there are no users that match "let@me.in"')
            }
        }
    }
}).export(module);
