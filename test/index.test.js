import { expect } from 'chai';
import { base, example } from 'feathers-service-tests';
import { MongoClient, ObjectID } from 'mongodb';
import feathers from 'feathers';
import errors from 'feathers-errors';
import service from '../src';
import server from './test-app';

describe('Feathers MongoDB Service', () => {
  const app = feathers();

  let db;

  before(() =>
    MongoClient.connect('mongodb://localhost:27017/feathers-test')
      .then(function (database) {
        db = database;

        app.use('/people', service({
          Model: db.collection('people'),
          events: [ 'testing' ]
        })).use('/people-customid', service({
          Model: db.collection('people-customid'),
          id: 'customid',
          events: [ 'testing' ]
        }));

        db.collection('people-customid').removeMany();
        db.collection('people').removeMany();
        db.collection('todos').removeMany();
      })
  );

  after(() => db.dropDatabase().then(() => db.close()));

  it('is CommonJS compatible', () =>
    expect(typeof require('../lib')).to.equal('function')
  );

  base(app, errors, 'people', '_id');
  base(app, errors, 'people-customid', 'customid');

  describe('Initialization', () => {
    describe('when missing options', () => {
      it('throws an error', () =>
        expect(service.bind(null)).to.throw('MongoDB options have to be provided')
      );
    });

    describe('when missing the id option', () => {
      it('sets the default to be _id', () =>
        expect(service({ Model: db }).id).to.equal('_id')
      );
    });

    describe('when missing the paginate option', () => {
      it('sets the default to be {}', () =>
        expect(service({ Model: db }).paginate).to.deep.equal({})
      );
    });
  });

  describe('MongoDB service example test', () => {
    before(() => server);
    after(done => {
      server.then(s => s.close(() => done()));
    });

    example('_id');
  });

  describe('Service utility functions', () => {
    describe('objectifyId', () => {
      it('returns an ObjectID instance for a valid ID', () => {
        let id = new ObjectID();
        let result = service({ Model: db })._objectifyId(id.toString(), '_id');
        expect(result).to.be.instanceof(ObjectID);
        expect(result).to.deep.equal(id);
      });

      it('does not return an ObjectID instance for an invalid ID', () => {
        let id = 'non-valid object id';
        let result = service({ Model: db })._objectifyId(id.toString(), '_id');
        expect(result).to.not.be.instanceof(ObjectID);
        expect(result).to.deep.equal(id);
      });
    });

    describe('multiOptions', () => {
      let params = {
        query: {
          age: 21
        },
        options: {
          limit: 5
        }
      };

      it('returns valid result when passed an ID', () => {
        let id = new ObjectID();
        let result = service({ Model: db })._multiOptions(id, params);
        expect(result).to.be.an('object');
        expect(result).to.include.all.keys(['query', 'options']);
        expect(result.query).to.deep.equal(Object.assign({}, params.query, { _id: id }));
        expect(result.options).to.deep.equal(Object.assign({}, params.options, { multi: false }));
      });

      it('returns original object', () => {
        let result = service({ Model: db })._multiOptions(null, params);
        expect(result).to.be.an('object');
        expect(result).to.include.all.keys(['query', 'options']);
        expect(result.query).to.deep.equal(params.query);
        expect(result.options).to.deep.equal(Object.assign({}, params.options, { multi: true }));
      });
    });

    describe('getSelect', () => {
      let mongoFields = { name: 1, age: 1 };

      it('returns Mongo fields object when an array is passed', () => {
        let fields = ['name', 'age'];
        let result = service({ Model: db })._getSelect(fields);
        expect(result).to.be.an('object');
        expect(result).to.deep.equal(mongoFields);
      });

      it('returns original object', () => {
        let fields = mongoFields;
        let result = service({ Model: db })._getSelect(fields);
        expect(result).to.be.an('object');
        expect(result).to.deep.equal(mongoFields);
      });
    });
  });

  describe('Special collation param', () => {
    let peopleService;

    function indexOfName (results, name) {
      let index;
      results.every(function (person, i) {
        if (person.name === name) {
          index = i;
          return false;
        }
        return true;
      });
      return index;
    }

    beforeEach(() => {
      peopleService = app.service('/people');

      return peopleService.remove(null, {}).then(() => {
        return peopleService.create([
          {name: 'AAA'},
          {name: 'aaa'},
          {name: 'ccc'}
        ]);
      });
    });

    it('sorts with default behavior without collation param', () => {
      return peopleService
        .find({ query: { $sort: {name: -1} } })
        .then(r => {
          expect(indexOfName(r, 'aaa')).to.be.below(indexOfName(r, 'AAA'));
        });
    });

    it('sorts using collation param if present', () => {
      return peopleService
        .find({ query: { $sort: {name: -1} }, collation: {locale: 'en', strength: 1} })
        .then(r => {
          expect(indexOfName(r, 'AAA')).to.be.below(indexOfName(r, 'aaa'));
        });
    });

    it('removes with default behavior without collation param', () => {
      return peopleService
        .remove(null, { query: { name: { $gt: 'AAA' } } })
        .then(() => {
          return peopleService.find().then((r) => {
            expect(r).to.have.lengthOf(1);
            expect(r[0].name).to.equal('AAA');
          });
        });
    });

    it('removes using collation param if present', () => {
      return peopleService
        .remove(null, { query: { name: { $gt: 'AAA' } }, collation: {locale: 'en', strength: 1} })
        .then(() => {
          return peopleService.find().then((r) => {
            expect(r).to.have.lengthOf(3);
          });
        });
    });

    it('updates with default behavior without collation param', () => {
      const query = { name: { $gt: 'AAA' } };

      return peopleService
        .patch(null, {age: 99}, { query })
        .then(r => {
          expect(r).to.have.lengthOf(2);
          r.forEach(person => {
            expect(person.age).to.equal(99);
          });
        });
    });

    it('updates using collation param if present', () => {
      return peopleService
        .patch(null, {age: 110}, { query: { name: { $gt: 'AAA' } }, collation: {locale: 'en', strength: 1} })
        .then(r => {
          expect(r).to.have.lengthOf(1);
          expect(r[0].name).to.equal('ccc');
        });
    });
  });
});
