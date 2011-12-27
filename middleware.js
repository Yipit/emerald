var _ = require('underscore')._;
var ansispan = require('ansispan');
var fs = require('fs');
var entity = require('./models');
var settings = require('./settings');

exports.authentication = function(request, response, next) {
    entity.User.find_by_id(request.session.user_id, function(err, user) {
        response.show = function (name, context) {
            var emerald_meta = {
                domain: settings.EMERALD_DOMAIN,
                hostname: settings.EMERALD_HOSTNAME,
                port: settings.EMERALD_PORT
            };
            var c = _.extend({
                title: 'Emerald - Continuous Integration',
                request: request,
                user: user,
                emerald: emerald_meta,
                emerald_json: JSON.stringify(emerald_meta),
            }, context || {});
            response.render(name, c);
        }
        return next();
    });
}