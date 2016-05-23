import feathers from 'feathers';
import rest from 'feathers-rest';
import socketio from 'feathers-socketio';
import errorHandler from 'feathers-errors/handler';
import bodyParser from 'body-parser';
import { MongoClient } from 'mongodb';
import service from '../lib';

// Create a feathers instance.
const app = feathers()
  // Enable Socket.io
  .configure(socketio())
  // Enable REST services
  .configure(rest())
  // Turn on JSON parser for REST services
  .use(bodyParser.json())
  // Turn on URL-encoded parser for REST services
  .use(bodyParser.urlencoded({extended: true}));

export default new Promise(function(resolve) {
  // Connect to your MongoDB instance(s)
  MongoClient.connect('mongodb://localhost:27017/feathers-test', (error, db) => {
    // Connect to the db, create and register a Feathers service.
    app.use('/todos', service({
      Model: db.collection('todos'),
      paginate: {
        default: 2,
        max: 4
      }
    }));

    // A basic error handler, just like Express
    app.use(errorHandler());

    // Start the server
    var server = app.listen(3030);
    server.on('listening', function() {
      console.log('Feathers Message MongoDB service running on 127.0.0.1:3030');
      resolve(server);
    });
  });
});
