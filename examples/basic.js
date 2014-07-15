var feathers = require('feathers');
var mongodb = require('../lib/mongodb');
var bodyParser = require('body-parser');
var app = feathers();

var userService = mongodb({ collection: 'users' });

app.configure(feathers.rest())
   .use(bodyParser.json())
   .use('/users', userService)
   .configure(feathers.errors())
   .listen(8080);

console.log('App listening on 127.0.0.1:8080');