var Proto = require('uberproto');
var mongo = require('mongoskin');
var errors = require('feathers').errors.types;
var filter = require('feathers-query-filters');
var _ = require('lodash');

var MongoService = Proto.extend({
  // TODO (EK): How do we handle indexes?
  init: function(collection, options) {
    if (_.isObject(collection)) {
      options = collection;
      collection = options.collection;
    }

    options = options || {};

    if (!collection) {
      throw new errors.GeneralError('No MongoDB collection name specified.');
    }

    this.type = 'mongodb';
    this.options = _.extend({
      _id: '_id'
    }, options);

    this._connect(this.options);
    this.collection = this.store.collection(collection);
  },

  // TODO (EK): We need to handle replica sets.
  _connect: function(options) {
    // If we are passing an existing connection we'll use that.
    if (options.connection) {
      this.store = options.connection;
      return;
    }
    
    var connectionString = options.connectionString;
    var ackOptions = {
      w: options.w || 1,                  // write acknowledgment
      journal: options.journal || false,  // doesn't wait for journal before acknowledgment
      fsync: options.fsync || false,       // doesn't wait for syncing to disk before acknowledgment
      safe: options.safe || false
    };

    if (!connectionString) {
      var config = _.extend({
        host: 'localhost',
        port: 27017,
        db: 'feathers',
        reconnect: true
      }, options);

      connectionString = 'mongodb://';

      if (config.username && config.password) {
        connectionString += config.username + ':' + config.password + '@';
      }

      connectionString += config.host + ':' + config.port + '/' + config.db;

      if (config.reconnect) {
        connectionString += '?auto_reconnect=true';
      }
    }

    this.store = mongo.db(connectionString, ackOptions);
  },

  find: function(params, cb) {
    if(_.isFunction(params)) {
      cb = params;
      params = {};
    }

    params.query = params.query || {};
    var options = params.options || {};
    var filters = filter(params.query);

    if (filters.$select && filters.$select.length) {
      options.fields = {};
      
      _.each(filters.$select, function(key){
        options.fields[key] = 1;
      });
    }

    if (filters.$sort){
      options.sort = filters.$sort;
    }

    if (filters.$limit){
      options.limit = filters.$limit;
    }

    if (filters.$skip){
      options.skip = filters.$skip;
    }

    this.collection.find(params.query, options).toArray(cb);
  },

  get: function(id, params, cb) {
    if(_.isFunction(id)) {
      cb = id;
      return cb(new errors.BadRequest('A string or number id must be provided'));
    }

    if(_.isFunction(params)) {
      cb = params;
      params = {};
    }

    if(_.isString(id)) {
      id = id.toLowerCase();
    }

    this.collection.findById(id, params.query || {}, function(error, data) {
      if(error) {
        return cb(error);
      }

      if(!data) {
        return cb(new errors.NotFound('No record found for id ' + id));
      }

      return cb(null, data);
    });
  },

  // TODO (EK): Batch support for create, update, delete.
  create: function(data, params, cb) {
    if(_.isFunction(params)) {
      cb = params;
      params = {};
    }

    this.collection.insert(data, params, function(error, data) {
      if(error || !data) {
        return cb(error);
      }

      cb(null, data.length === 1 ? data[0] : data);
    });
  },

  patch: function(id, data, params, cb) {
    if(_.isFunction(params)) {
      cb = params;
      params = {};
    }

    var _get = this.get.bind(this);

    this.collection.updateById(id, { $set: data }, params, function(error) {
      if(error) {
        return cb(error);
      }

      _get(id, {}, cb);
    }.bind(this));
  },

  update: function(id, data, params, cb) {
    if(_.isFunction(params)) {
      cb = params;
      params = {};
    }

    var _get = this.get.bind(this);

    this.collection.updateById(id, data, params, function(error) {
      // TODO (DL) maybe we should throw a NotFound error already but
      // that doesn't seem to be necessary
      if(error) {
        return cb(error);
      }

      _get(id, {}, cb);
    }.bind(this));
  },

  remove: function(id, params, cb) {
    if(_.isFunction(params)) {
      cb = params;
      params = {};
    }

    var collection = this.collection;

    this.get(id, params, function(error, data) {
      if(error) {
        return cb(error);
      }

      collection.removeById(id, params.query || {}, function(error) {
        if(error) {
          return cb(error);
        }

        cb(null, data);
      });
    });
  }
});

module.exports = function(collection, options) {
  return Proto.create.call(MongoService, collection, options);
};

module.exports.Service = MongoService;
