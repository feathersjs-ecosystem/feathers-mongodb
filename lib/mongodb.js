var Proto = require('uberproto');
var mongo = require('mongoskin');
var errors = require('feathers-errors').types;
var _ = require('lodash');

var MongoService = Proto.extend({
  // TODO (EK): How do we handle indexes?
  init: function(options) {
    options = options || {};

    if(!options.collection) {
      throw new errors.GeneralError('No MongoDB collection name specified.');
    }

    this.type = 'mongodb';
    this.options = _.extend({
      _id: '_id'
    }, options);

    this._connect(this.options);
  },

  // TODO (EK): We need to handle replica sets.
  _connect: function(options) {
    if (typeof options.collection === 'string') {
      var connectionString = options.connectionString;
      var ackOptions = {
        w: options.w || 1,                  // write acknowledgment
        journal: options.journal || false,  // doesn't wait for journal before acknowledgment
        fsync: options.fsync || false,       // doesn't wait for syncing to disk before acknowledgment
        safe: options.safe || false
      };

      if(!connectionString) {
        var config = _.extend({
          host: 'localhost',
          port: 27017,
          db: 'feathers'
        }, options);

        connectionString = config.host + ':' + config.port + '/' + config.db;
      }

      if(options.username && options.password) {
        connectionString += options.username + ':' + options.password + '@';
      }

      if(options.reconnect) {
        connectionString += '?auto_reconnect=true';
      }

      this.store = mongo.db(connectionString, ackOptions);
      this.collection = this.store.collection(options.collection);
    } else {
      this.collection = options.collection;
    }
  },

  find: function(params, cb) {
    if(_.isFunction(params)) {
      cb = params;
      params = {};
    }

    this.collection.find(params.query || {}, params.options || {}).toArray(cb);
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

module.exports = function(options) {
  return Proto.create.call(MongoService, options);
};

module.exports.Service = MongoService;
