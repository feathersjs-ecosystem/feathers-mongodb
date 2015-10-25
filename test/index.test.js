var chai = require('chai');
var expect = chai.expect;
var DatabaseCleaner = require('database-cleaner');
var databaseCleaner = new DatabaseCleaner('mongodb');
var errors = require('feathers').errors.types;

var mongodb = require('../lib');
var service = mongodb('people');
var _ids = {};

function clean(done) {
  databaseCleaner.clean(service.store, function() {
    service.store.close();
    done();
  });
}

describe('Feathers MongoDB Service', function() {
  before(clean);
  after(clean);

  beforeEach(function(done) {
    service.create({
      name: 'Doug',
      age: 32
    }, function(error, data) {
      if (error) {
        console.error(error);
      }

      _ids.Doug = data._id;
      done();
    });
  });

  afterEach(function(done) {
    service.remove(_ids.Doug, function() {
      done();
    });
  });

  describe('init', function() {
    describe('with collection', function() {
      it('throws an error', function() {
        expect(mongodb).to.throw('No MongoDB collection name specified.');
      });
    });

    describe('with collection', function() {
      it('sets up a mongo connection collection string', function(done) {
        var myService = mongodb('other-test', {
          db: 'some-database'
        });

        myService.create({ name: 'David' }, function(error, data) {
          expect(error).to.be.null;
          expect(data._id).to.be.ok;
          databaseCleaner.clean(myService.store, function() {
            myService.store.close();
            done();
          });
        });
      });

      it('sets up a mongo connection based on config', function(done) {
        var myService = mongodb({
          db: 'some-database',
          collection: 'other-test'
        });

        myService.create({ name: 'David' }, function(error, data) {
          expect(error).to.be.null;
          expect(data._id).to.be.ok;
          databaseCleaner.clean(myService.store, function() {
            myService.store.close();
            done();
          });
        });
      });
    });

    it('sets up a mongo connection based on a connection string', function(done) {
      var otherService = mongodb('other-test', {
        connectionString: 'mongodb://localhost:27017/dummy-db'
      });

      otherService.create({ name: 'David' }, function(error, data) {
        expect(error).to.be.null;
        expect(data._id).to.be.ok;
        databaseCleaner.clean(otherService.store, function() {
          otherService.store.close();
          done();
        });
      });
    });
  });

  describe('get', function() {
    it('returns an instance that exists', function(done) {
      service.get(_ids.Doug, function(error, data) {
        expect(error).to.be.null;
        expect(data._id.toString()).to.equal(_ids.Doug.toString());
        expect(data.name).to.equal('Doug');
        done();
      });
    });

    it('returns an error when no id is provided', function(done) {
      service.get(function(error, data) {
        expect(error).to.be.ok;
        expect(error instanceof errors.BadRequest).to.be.ok;
        expect(data).to.be.undefined;
        done();
      });
    });

    it('returns NotFound error for non-existing id', function(done) {
      service.get('abc', function(error) {
        expect(error).to.be.ok;
        expect(error instanceof errors.NotFound).to.be.ok;
        expect(error.message).to.equal('No record found for id abc');
        done();
      });
    });
  });

  describe('remove', function() {
    it('deletes an existing instance and returns the deleted instance', function(done) {
      service.remove(_ids.Doug, function(error, data) {
        expect(error).to.be.null;
        expect(data).to.be.ok;
        expect(data.name).to.equal('Doug');
        done();
      });
    });
  });

  describe('find', function() {
    beforeEach(function(done) {
      service.create({
        name: 'Bob',
        age: 25
      }, function(err, bob) {

        _ids.Bob = bob._id;

        service.create({
          name: 'Alice',
          age: 19
        }, function(err, alice) {
          _ids.Alice = alice._id;

          done();
        });
      });
    });

    afterEach(function(done) {
      service.remove(_ids.Bob, function() {
        service.remove(_ids.Alice, function() {
          done();
        });
      });
    });

    it('returns all items', function(done) {
      service.find({}, function(error, data) {
        expect(error).to.be.null;
        expect(data).to.be.instanceof(Array);
        expect(data.length).to.equal(3);
        done();
      });
    });

    it('filters results by query parameters', function(done) {
      service.find({ query: { name: 'Alice' } }, function(error, data) {
        expect(error).to.be.null;
        expect(data).to.be.instanceof(Array);
        expect(data.length).to.equal(1);
        expect(data[0].name).to.equal('Alice');
        done();
      });
    });

    it('can $sort', function(done) {
      var params = {
        query: {
          $sort: {name: 1}
        }
      };

      service.find(params, function(error, data) {
        expect(error).to.be.null;
        expect(data.length).to.equal(3);
        expect(data[0].name).to.equal('Alice');
        expect(data[1].name).to.equal('Bob');
        expect(data[2].name).to.equal('Doug');
        done();
      });
    });

    it('can $limit', function(done) {
      var params = {
        query: {
          $limit: 2
        }
      };
      
      service.find(params, function(error, data) {
        expect(error).to.be.null;
        expect(data.length).to.equal(2);
        done();
      });
    });

    it('can $skip', function(done) {
      var params = {
        query: {
          $sort: {name: 1},
          $skip: 1
        }
      };
      
      service.find(params, function(error, data) {
        expect(error).to.be.null;
        expect(data.length).to.equal(2);
        expect(data[0].name).to.equal('Bob');
        expect(data[1].name).to.equal('Doug');
        done();
      });
    });

    it('can $select', function(done) {
      var params = {
        query: {
          name: 'Alice',
          $select: ['name']
        }
      };
      
      service.find(params, function(error, data) {
        expect(error).to.be.null;
        expect(data.length).to.equal(1);
        expect(data[0].name).to.equal('Alice');
        expect(data[0].age).to.be.undefined;
        done();
      });
    });
  });

  describe('update', function() {
    it('replaces an existing instance', function(done) {
      service.update(_ids.Doug, { name: 'Dougler' }, function(error, data) {
        expect(error).to.be.null;
        expect(data._id.toString()).to.equal(_ids.Doug.toString());
        expect(data.name).to.equal('Dougler');
        expect(data.age).to.be.undefined;
        done();
      });
    });

    it('throws an error when updating non-existent instances', function(done) {
      service.update('bla', { name: 'NotFound' }, function(error) {
        expect(error).to.be.ok;
        expect(error instanceof errors.NotFound).to.be.ok;
        expect(error.message).to.equal('No record found for id bla');
        done();
      });
    });
  });

  describe('patch', function() {
    it('replaces an existing instance', function(done) {
      service.patch(_ids.Doug, { name: 'PatchDoug' }, function(error, data) {
        expect(error).to.be.null;
        expect(data._id.toString()).to.equal(_ids.Doug.toString());
        expect(data.name).to.equal('PatchDoug');
        expect(data.age).to.equal(32);
        done();
      });
    });

    it('throws an error when updating non-existent instances', function(done) {
      service.patch('bla', { name: 'NotFound' }, function(error) {
        expect(error).to.be.ok;
        expect(error instanceof errors.NotFound).to.be.ok;
        expect(error.message).to.equal('No record found for id bla');
        done();
      });
    });
  });

  describe('create', function() {
    it('creates a single new instance and call back with only one', function(done) {
      service.create({
        name: 'Bill'
      }, function(error, data) {
        expect(error).to.be.null;
        expect(data).to.be.instanceof(Object);
        expect(data).to.not.be.empty;
        expect(data.name).to.equal('Bill');
        done();
      });
    });

    it('creates multiple new instances', function(done) {
      var items = [
        {
          name: 'Gerald'
        },
        {
          name: 'Herald'
        }
      ];

      service.create(items, function(error, data) {
        expect(error).to.be.null;
        expect(data).to.be.instanceof(Array);
        expect(data).to.not.be.empty;
        expect(data[0].name).to.equal('Gerald');
        expect(data[1].name).to.equal('Herald');
        done();
      });
    });
  });
});
