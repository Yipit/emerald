var redis = require('redis');
var client = redis.createClient();

desc('cleanse the database');
task('default', [], function () {
    console.log('cleaning redis...')
    client.keys('*', function(err, keys){
        if (keys.length > 0) {
            client.del(keys, function(){
                process.exit(0);
            });
        } else {
            process.exit(0);
        }
    });
});