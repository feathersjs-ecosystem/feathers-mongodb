feathers-mongodb
================

[![NPM](https://nodei.co/npm/feathers-mongodb.png?downloads=true&stars=true)](https://nodei.co/npm/feathers-mongodb/)

[![Build Status](https://travis-ci.org/feathersjs/feathers-mongodb.png?branch=master)](https://travis-ci.org/feathersjs/feathers-mongodb)
[![Code Climate](https://codeclimate.com/github/feathersjs/feathers-mongodb.png)](https://codeclimate.com/github/feathersjs/feathers-mongodb)

> Create a MongoDB service for [FeathersJS](http://feathersjs.com)

## Getting Started

To install feathers-hooks from [npm](https://www.npmjs.org/), run:

```bash
$ npm install feathers-mongodb --save
```

Creating an MongoDB service is this simple:

```js
var mongoService = require('feathers-mongodb');
app.use('todos', mongoService('todos', options));
```

### Complete Example

Here's a complete example of a Feathers server with a `todos` mongodb-service.

```js
// server.js
var feathers = require('feathers'),
  bodyParser = require('body-parser'),
  mongoService = require('feathers-mongo');

// Create a feathers instance.
var app = feathers()
  // Setup the public folder.
  .use(feathers.static(__dirname + '/public'))
  // Enable Socket.io
  .configure(feathers.socketio())
  // Enable REST services
  .configure(feathers.rest())
  // Turn on JSON parser for REST services
  .use(bodyParser.json())
  // Turn on URL-encoded parser for REST services
  .use(bodyParser.urlencoded({extended: true}))

// Connect to the db, create and register a Feathers service.
app.use('todos', new mongoService('todos'));

// Start the server.
var port = 8080;
app.listen(port, function() {
    console.log('Feathers server listening on port ' + port);
});
```

You can run this example by using `node examples/basic` and going to [localhost:8080/todos](http://localhost:8080/todos). You should see an empty array. That's because you don't have any Todos yet but you now have full CRUD for your new todos service!

## Options

The following options can be passed when creating a new MongoDB service:

**General options:**

- `connectionString` - A MongoDB connection string
- `_id` - The id property (default: `"_id"`)

**Connection options:** (when `connectionString` is not set)

- `db` - The name of the database (default: `"feathers"`) 
- `host` - The MongoDB host (default: `"localhost"`) 
- `port` - The MongoDB port (default: `27017`)
- `username` - MongoDB username
- `password` - MongoDB password
- `reconnect` - Whether the connection should automatically reconnect (default: `true`)

**MongoDB options:**

- `w` - Write acknowledgments (default: `1`) 
- `journal` - Don't wait for journal before acknowledgment (default: `false`) 
- `fsync` - Don't wait for syncing to disk before acknowledgment (default: `false`) 
- `safe` - Safe mode (default: `false`)

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

```js
var feathers = require('feathers');
var hooks = require('feathers-hooks');
var mongodb = require('feathers-mongodb');

// Initialize a MongoDB service with the users collection on a local MongoDB instance
var app = feathers()
  .configure(hooks())
  .use('/users', mongodb({
    collection: 'users'
  }));
  
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

## Special Query Params
The `find` API allows the use of `$limit`, `$skip`, `$sort`, and `$select` in the query.  These special parameters can be passed directly inside the query object:

```js
// Find all recipes that include salt, limit to 10, only include name field.
{"ingredients":"salt", "$limit":10, "$select":"name:1"} // JSON
GET /?ingredients=salt&%24limit=10&%24select=name%3A1 // HTTP
```

As a result of allowing these to be put directly into the query string, you won't want to use `$limit`, `$skip`, `$sort`, or `$select` as the name of fields in your document schema.

### `$limit`

`$limit` will return only the number of results you specify:

```
// Retrieves the first two records found where age is 37.
query: {
  age: 37,
  $limit: 2
}
```


### `$skip`

`$skip` will skip the specified number of results:

```
// Retrieves all except the first two records found where age is 37.
query: {
  age: 37,
  $skip: 2
}
```


### `$sort`

`$sort` will sort based on the object you provide:

```
// Retrieves all where age is 37, sorted ascending alphabetically by name.
query: {
  age: 37,
  $sort: {'name': 1}
}

// Retrieves all where age is 37, sorted descending alphabetically by name.
query: {
  age: 37,
  $sort: {'name': -1}
}
```


### `$select`
`$select` support in a query allows you to pick which fields to include or exclude in the results.  Note: you can use the include syntax or the exclude syntax, not both together.  See the section on [`Select`](http://mongoosejs.com/docs/api.html#query_Query-select) in the Mongoose docs.
```
// Only retrieve name.
query: {
  name: 'Alice',
  $select: {'name': 1}
}

// Retrieve everything except age.
query: {
  name: 'Alice',
  $select: {'age': 0}
}
```

## API

`feathers-mongodb` services comply with the standard [FeathersJS API](http://feathersjs.com/docs).

## Changelog

### 1.0.0
- makes this adapter consistent with the others in terms of documentation and file structure
- updates mongoskin dependency to the latest
- adds support for special query filters
    - $sort
    - $select
    - $skip
    - $limit
- Closes #8 by making sure that we autoreconnect by default when not passing a connection string

### 0.3.0

- Implement `.patch` support ([#5](https://github.com/feathersjs/feathers-mongodb/issues/5))
- Better documentation
- Refactoring that removes pre-implemented MongoSkin options

### 0.2.x

- Pre-releases

## License

[MIT](LICENSE)

## Authors

- [Eric Kryski](https://github.com/ekryski)
- [David Luecke](https://github.com/daffl)
