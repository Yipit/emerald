var models = require('../models'),
    utils  = require('./utils'),
    assert = require('assert');

var Project = models.Project;
var User = models.User;

exports.async = {}

/*
  this topics may be used in many tests in a row, so let's make it a
little bit unique (just a little ;) */

var _sandbox_counter = 1;

exports.async['has_user_and_project'] = function (callback){
    var user_data = {
        username: "project-owner" + _sandbox_counter,
        email: "admin@" + _sandbox_counter + "pmanagers.com",
        password: "123456"
    }
    _sandbox_counter ++;
    return function(){
        var self = this;
        utils.clear_all_data(models.db);
        User.create(user_data, function(user_err, user){
            var project_data = {
                name: 'Lettuce Unit Tests' + _sandbox_counter,
                created_by: user,
                build_script: 'bash run-build-for unit',
                repository: 'github://gabrielfalcao@emerald'
            };
            Project.create(project_data, function(prj_err, project){
                callback.apply(self, [user, project]);
            });
        });
    }

}