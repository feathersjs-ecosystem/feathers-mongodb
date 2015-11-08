var baseTests = require('feathers-service-tests');
var DatabaseCleaner = require('database-cleaner');
var databaseCleaner = new DatabaseCleaner('mongodb');
var errors = require('feathers').errors.types;

var mongodb = require('../lib');
var people = mongodb('people');
var _ids = {};

function clean(done) {
  databaseCleaner.clean(people.store, function() {
    people.store.close();
    done();
  });
}

describe('MongoDB Service', function() {
  before(clean);
  after(clean);

  beforeEach(function(done) {
    people.create({
      name: 'Doug',
      age: 32
    }, function(error, data) {
      _ids.Doug = '' + data._id;
      done();
    });
  });

  afterEach(function(done) {
    people.get(_ids.Doug, {}, function(error, data) {
      if(data) {
        return people.remove(_ids.Doug, done);
      }
      done();
    });
  });

  baseTests(people, _ids, errors, '_id');
});
