import { expect } from 'chai';
import { base, example } from 'feathers-service-tests';
import { MongoClient } from 'mongodb';
import feathers from 'feathers';
import errors from 'feathers-errors';
import service from '../src';
import server from './test-app';

describe('Feathers MongoDB Service', () => {
  const _ids = {};
  const app = feathers()
    .use('/people', service({ Model: {} }));
  
  let db, people;
  
  before((done) => {
    MongoClient.connect('mongodb://localhost:27017/feathers').then(function(database) {
      db = database;
      
      app.service('people').Model = db.collection('people');
      
      done();
    });
  });
  
  it('is CommonJS compatible', () => {
    expect(typeof require('../lib')).to.equal('function');
  });


  describe('Initialization', () => {
    describe('when missing options', () => {
      it('throws an error', () => {
        expect(service.bind(null)).to.throw('MongoDB options have to be provided');
      });
    });

    describe('when missing a Model', () => {
      it('throws an error', () => {
        expect(service.bind(null, {})).to.throw('MongoDB collection `Model` needs to be provided');
      });
    });

    describe('when missing the id option', () => {
      it('sets the default to be _id', () => {
        expect(people.id).to.equal('_id');
      });
    });

    describe('when missing the paginate option', () => {
      it('sets the default to be {}', () => {
        expect(people.paginate).to.deep.equal({});
      });
    });
  });

  describe('Common functionality', () => {
    beforeEach(function(done) {
      db.collection('people').insert({
        name: 'Doug',
        age: 32
      }, function(error, data) {
        if(error) {
          return done(error);
        }

        _ids.Doug = data._id;
        done();
      });
    });

    afterEach(done => db.collection('people').remove({ _id: _ids.Doug }, () => done()));

    base(app.service('people'), _ids, errors, '_id');
  });

  describe('MongoDB service example test', () => {
    before(done => server.then(() => done()));
    after(done => server.then(s => s.close(() => done())));

    example('_id');
  });
});
