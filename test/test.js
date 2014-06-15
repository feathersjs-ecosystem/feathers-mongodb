var chai = require('chai');
var expect = chai.expect;
var DatabaseCleaner = require('database-cleaner');
var databaseCleaner = new DatabaseCleaner('mongodb');
var errors = require('feathers').errors.types;

var mongodb = require('./../lib/mongodb');
var service = mongodb({
  collection: 'test'
});
var _ids = {};

function clean(done) {
  databaseCleaner.clean(service.store, function() {
    service.store.close();
    done();
  });
}

describe('Mongo Service', function() {
  before(clean);
  after(clean);

  beforeEach(function(done) {
    service.create({
      name: 'Doug',
      age: 32
    }, function(error, data) {
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
    it('should setup a mongo connection based on config');
    it('should setup a mongo connection based on ENV vars');
    it('should setup a mongo connection based on a connection string');
  });

  describe('get', function() {
    it('should return an instance that exists', function(done) {
      service.get(_ids.Doug, function(error, data) {
        expect(error).to.be.null;
        expect(data._id.toString()).to.equal(_ids.Doug.toString());
        expect(data.name).to.equal('Doug');
        done();
      });
    });

    it('should return an error when no id is provided', function(done) {
      service.get(function(error, data) {
        expect(error).to.be.ok;
        expect(error instanceof errors.BadRequest).to.be.ok;
        expect(data).to.be.undefined;
        done();
      });
    });

    it('should return NotFound error for non-existing id', function(done) {
      service.get('abc', function(error) {
        expect(error).to.be.ok;
        expect(error instanceof errors.NotFound).to.be.ok;
        expect(error.message).to.equal('No record found for id abc');
        done();
      });
    });
  });

  describe('remove', function() {
    it('should delete an existing instance and return the deleted instance', function(done) {
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

    it('should return all items', function(done) {
      service.find({}, function(error, data) {
        expect(error).to.be.null;
        expect(data).to.be.instanceof(Array);
        expect(data.length).to.equal(3);
        done();
      });
    });

    it('passes in options', function(done) {
      service.find({
        query: {},
        options: { sort: [['name', 1]] }
      }, function(error, data) {
        expect(error).to.be.null;
        expect(data.length).to.equal(3);
        expect(data[0].name).to.equal('Alice');
        expect(data[1].name).to.equal('Bob');
        expect(data[2].name).to.equal('Doug');
        done();
      });
    });

    it('query filters by parameter', function(done) {
      service.find({ query: { name: 'Alice' } }, function(error, data) {
        expect(error).to.be.null;
        expect(data).to.be.instanceof(Array);
        expect(data.length).to.equal(1);
        expect(data[0].name).to.equal('Alice');
        done();
      });
    });
  });

  describe('update', function() {
    it('should replace an existing instance', function(done) {
      service.update(_ids.Doug, { name: 'Dougler' }, function(error, data) {
        expect(error).to.be.null;
        expect(data._id.toString()).to.equal(_ids.Doug.toString());
        expect(data.name).to.equal('Dougler');
        expect(data.age).to.be.undefined;
        done();
      });
    });

    it('should throw an error when updating non-existent instances', function(done) {
      service.update('bla', { name: 'NotFound' }, function(error) {
        expect(error).to.be.ok;
        expect(error instanceof errors.NotFound).to.be.ok;
        expect(error.message).to.equal('No record found for id bla');
        done();
      });
    });
  });

  describe('patch', function() {
    it('should replace an existing instance', function(done) {
      service.patch(_ids.Doug, { name: 'PatchDoug' }, function(error, data) {
        expect(error).to.be.null;
        expect(data._id.toString()).to.equal(_ids.Doug.toString());
        expect(data.name).to.equal('PatchDoug');
        expect(data.age).to.equal(32);
        done();
      });
    });

    it('should throw an error when updating non-existent instances', function(done) {
      service.patch('bla', { name: 'NotFound' }, function(error) {
        expect(error).to.be.ok;
        expect(error instanceof errors.NotFound).to.be.ok;
        expect(error.message).to.equal('No record found for id bla');
        done();
      });
    });
  });

  describe('create', function() {
    it('should create a single new instance and call back with only one', function(done) {
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

    it('should create multiple new instances', function(done) {
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
