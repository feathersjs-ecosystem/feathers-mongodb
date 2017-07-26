feathers-mongodb
================

[![Greenkeeper badge](https://badges.greenkeeper.io/feathersjs/feathers-mongodb.svg)](https://greenkeeper.io/)

[![Build Status](https://travis-ci.org/feathersjs/feathers-mongodb.png?branch=master)](https://travis-ci.org/feathersjs/feathers-mongodb)
[![Code Climate](https://codeclimate.com/github/feathersjs/feathers-mongodb/badges/gpa.svg)](https://codeclimate.com/github/feathersjs/feathers-mongodb)
[![Test Coverage](https://codeclimate.com/github/feathersjs/feathers-mongodb/badges/coverage.svg)](https://codeclimate.com/github/feathersjs/feathers-mongodb/coverage)
[![Dependency Status](https://img.shields.io/david/feathersjs/feathers-mongodb.svg?style=flat-square)](https://david-dm.org/feathersjs/feathers-mongodb)
[![Download Status](https://img.shields.io/npm/dm/feathers-mongodb.svg?style=flat-square)](https://www.npmjs.com/package/feathers-mongodb)
[![Slack Status](http://slack.feathersjs.com/badge.svg)](http://slack.feathersjs.com)

> A MongoDB CRUD service for [FeathersJS](http://feathersjs.com)


## Installation

```bash
npm install mongodb feathers-mongodb --save
```

## Documentation

Please refer to the [Feathers database adapter documentation](https://docs.feathersjs.com/api/databases/common.html) for more details or directly at:

- [MongoDB](https://docs.feathersjs.com/api/databases/mongodb.html) - The detailed documentation for this adapter
- [Extending](https://docs.feathersjs.com/api/databases/common.html#extending-adapters) - How to extend a database adapter
- [Pagination](https://docs.feathersjs.com/api/databases/common.html#pagination) - How to use pagination
- [Querying and Sorting](https://docs.feathersjs.com/api/databases/querying.html) - The common adapter querying mechanism and sorting for the database adapter

## Getting Started

You can create a MongoDB service like this:

```js
var MongoClient = require('mongodb').MongoClient;
var service = require('feathers-mongodb');
var app = feathers();

MongoClient.connect('mongodb://localhost:27017/feathers').then(function(db){
  app.use('/messages', service({
    Model: db
  }));

  app.listen(3030);
});
```

This will create a `messages` endpoint and connect to a local `messages` collection on the `feathers` database.


### Complete Example

Here's a complete example of a Feathers server with a `messages` MongoDB service.

```js
const feathers = require('feathers');
const rest = require('feathers-rest');
const socketio = require('feathers-socketio');
const handler = require('feathers-errors/handler');
const bodyParser = require('body-parser');
var MongoClient = require('mongodb').MongoClient;
const service = require('feathers-mongodb');

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


const promise = new Promise(function(resolve) {
  // Connect to your MongoDB instance(s)
  MongoClient.connect('mongodb://localhost:27017/feathers').then(function(db){
    // Connect to the db, create and register a Feathers service.
    app.use('/messages', service({
      Model: db.collection('messages'),
      paginate: {
        default: 2,
        max: 4
      }
    }));

    // A basic error handler, just like Express
    app.use(handler());

    // Start the server
    var server = app.listen(3030);
    server.on('listening', function() {
      console.log('Feathers Message MongoDB service running on 127.0.0.1:3030');
      resolve(server);
    });
  }).catch(function(error){
    console.error(error);
  });
});

module.exports = promise;
```

You can run this example by using `npm start` and going to [localhost:3030/messages](http://localhost:3030/messages). You should see an empty array. That's because you don't have any messages yet but you now have full CRUD for your new message service!

## License

Copyright (c) 2016

Licensed under the [MIT license](LICENSE).
