feathers-mongodb
================

[![Build Status](https://travis-ci.org/feathersjs/feathers-mongodb.png?branch=master)](https://travis-ci.org/feathersjs/feathers-mongodb)
[![Code Climate](https://codeclimate.com/github/feathersjs/feathers-mongodb.png)](https://codeclimate.com/github/feathersjs/feathers-mongodb)

A MongoDB CRUD service for [feathers](http://feathersjs.com)

## Getting Started

To install feathers-hooks from [npm](https://www.npmjs.org/), run:

```bash
$ npm install feathers-mongodb --save
```

Finally, to use the plugin in your Feathers app:

```javascript
var feathers = require('feathers');
var mongodb = require('feathers-mongodb');

// Initialize a MongoDB service with the users collection on a local MongoDB instance
var app = feathers()
  .use('/users', mongodb({
    collection: 'users'
  }));
  
app.listen(8080);
```

## Options

The following options can be passed when creating a new MongoDB service:

General options:

- `collection` - The name of the collection or an already-connected collection object.  When using an object, no other options are needed.  See the example below.
- `connectionString` - A MongoDB connection string
- `[_id]` (default: `"_id"`) - The id property
- `username` - MongoDB username
- `password` - MongoDB password

Connection options (when `connectionString` is not set):

- `db` (default: `"feathers"`) - The name of the database
- `host` (default: `"localhost"`) - The MongoDB host
- `port` (default: `27017`) - The MongoDB port

MongoDB options:

- `w` (default: `1`) - Write acknowledgements
- `journal` (default: `false`) - Don't wait for journal before acknowledgement
- `fsync` (default: `false`) - Don't wait for syncing to disk before acknowledgment
- `safe` (default: `false`) - Safe mode 

## Sharing a MongoDB connection between services
When creating a new service, the default behavior is to create a new connection to the specified database.  If you would rather share a database connection between multiple services, connect to the database then pass an already-connected collection object in on options.collection.  For example:

```js
var feathers = require('feathers')
  , mongo = require('mongoskin')
  , mongoService = require('feathers-mongodb')
  , app = feathers();

// First, make the connection.
var db = mongo.db('mongodb://localhost:27017/my-project');

// Use the same db connection in both of these services.
app.use('/api/users', mongoService({collection:db.collection('users')}));
app.use('/api/todos', mongoService({collection:db.collection('todos')}));

app.listen(8080);
```

## Extending MongoDB services

To extend the basic MongoDB service there are two options. Either through using [Uberproto's](https://github.com/daffl/uberproto) inheritance mechanism or by using [feathers-hooks](https://github.com/feathersjs/feathers-hooks).

### With Uberproto

The basic MongoDB Feathers service is implemented using [Uberproto](https://github.com/daffl/uberproto), a small EcmaScript 5 inheritance library so you can use the Uberproto syntax to add your custom functionality.
For example, you might want `update` and `patch` to behave the same (the basic implementation of `update` replaces the entire object instead of merging it) and add an `updatedAt` and `createdAt` flag to your data:

```js
// myservice.js
var mongodb = require('feathers-mongodb');
var Proto = require('uberproto');

var TimestampPatchService = mongodb.Service.extend({
  create: function(data, params, callback) {
    data.createdAt = new Date();
    
    // Call the original `create`
    return this._super(data, params, callback);
  },
  
  update: function() {
    // Call `patch` instead so that PUT calls merge
    // instead of replace data, too
    this.patch(id, data, params, callback);
  },
  
  patch: function(id, data, params, callback) {
    data.updatedAt = new Date();
    
    // Call the original `patch`
    this._super(id, data, params, callback);
  }
});

// Export a simple function that instantiates this new service like
// var myservice = require('myservice');
// app.use('/users', myservice(options));
module.exports = function(options) {
  // We need to call `Proto.create` explicitly here since we are overriding
  // the original `create` method
  return Proto.create.call(TimestampPatchService, options);
}

module.exports.Service = TimestampPatchService;
```

### With hooks

Another option is to weave functionality into your existing services using [feathers-hooks](https://github.com/feathersjs/feathers-hooks), for example the above `createdAt` and `updatedAt` functionality:

```javascript
var feathers = require('feathers');
var hooks = require('feathers-hooks');
var mongodb = require('feathers-mongodb');

// Initialize a MongoDB service with the users collection on a local MongoDB instance
var app = feathers()
  .configure(hooks())
  .use('/users', mongodb({
    collection: 'users'
  });
  
app.lookup('users').before({
  create: function(hook, next) {
    hook.data.createdAt = new Date();
    next();
  },
  
  update: function(hook, next) {
    hook.data.updatedAt = new Date();
    next();
  }
});

app.listen(8080);
```

## MongoDB options and filtering

Internally the MongoDB service uses [MongoSkin](https://github.com/kissjs/node-mongoskin).
The query options (e.g. for a `.find`) call are taken from `params.query`.
To set the query options, set `params.options` in your service calls. Using [feathers-hooks](https://github.com/feathersjs/feathers-hooks), for example, a sort mechanism based on query parameters
(e.g. `/users?__sort=name`) can be implemented as a hook like this:

```js
var app = feathers()
  .configure(hooks())
  .use('/users', mongodb({
    collection: 'users'
  });
  
app.lookup('users').before({
  find: function(hook, next) {
    // Grab the fieldname from `params.query`
    var field = hook.params.query.__sort;
    if(field) {
      hook.params.options = { sort: [[field, -1]] };
    }
    // Delete it from the query so that it's not passed as
    // the MongoSkin query object
    delete hook.params.query.__sort;
    
    next();
  }
});
```


## Changelog

__0.3.0__

- Implement `.patch` support ([#5](https://github.com/feathersjs/feathers-mongodb/issues/5))
- Better documentation
- Refactoring that removes pre-implemented MongoSkin options

__0.2.x__

- Pre-releases

## Authors

- [Eric Kryski](https://github.com/ekryski)
- [David Luecke](https://github.com/daffl)

## License

Copyright (c) 2014 Eric Kryski, David Luecke

Licensed under the [MIT license](LICENSE).
