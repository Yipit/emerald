var models = require('./models');

exports.setup = function(app, io){
    var entity = models.prepare(io, app);

    app.get('/', function(req, res){
        res.show('index');
    });
    app.get('/manage/instructions', function(req, res){
        res.show('manage-instructions');
    });
    app.get('/manage/users', function(req, res){
        res.show('manage-users');
    });
    app.get('/settings', function(req, res){
        res.show('settings');
    });
    app.get('/plugins', function(req, res){
        res.show('plugins');
    });
}
