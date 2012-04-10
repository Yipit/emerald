return;

var path = require('path');
var cp = require('child_process');
var request = require('request');
var should = require('should');
var server = null;

payload = require('./github-payload.json');

describe('Emerald Webserver', function(){
    before(function(done){
        var settings_path = [__dirname, '.settings.js'].join('/');
        var args = [path.resolve(__dirname, '../../app/terminal/main.js'), '--settings', settings_path, 'run'];

        server = cp.spawn('node', args);
        server.stdout.on('data', function (data) {
            if (/running with an interval/.test(data.toString())) {
                done();
            }
        });
    });
    after(function(done){
        if (server) {
            server.kill('SIGKILL');
            done();
        }
    });

    describe('github-hook', function(){
        it('takes a slug and return a response with the build data', function(done){
            request.post({
                url: 'http://localhost:8822/hooks/github/emerald-unit-tests',
                body: JSON.stringify(payload)
            }, function(error, response, body){
                if (error) {return done(error);}
                response.statusCode.should.equal(201, 'response should be "201 Created"');

                var data = JSON.parse(body);
                data.slug.should.equal('emerald-unit-tests');
                done();
            });
        })
    })
})