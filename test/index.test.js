const { expect } = require('chai');
const { MongoClient, ObjectID } = require('mongodb');
const adapterTests = require('@feathersjs/adapter-tests');

const feathers = require('@feathersjs/feathers');
const errors = require('@feathersjs/errors');

const service = require('../lib');
const testSuite = adapterTests([
  '.options',
  '.events',
  '._get',
  '._find',
  '._create',
  '._update',
  '._patch',
  '._remove',
  '.get',
  '.get + $select',
  '.get + id + query',
  '.get + NotFound',
  '.find',
  '.remove',
  '.remove + $select',
  '.remove + id + query',
  '.remove + multi',
  '.update',
  '.update + $select',
  '.update + id + query',
  '.update + NotFound',
  '.patch',
  '.patch + $select',
  '.patch + id + query',
  '.patch multiple',
  '.patch multi query',
  '.patch + NotFound',
  '.create',
  '.create + $select',
  '.create multi',
  'internal .find',
  'internal .get',
  'internal .create',
  'internal .update',
  'internal .patch',
  'internal .remove',
  '.find + equal',
  '.find + equal multiple',
  '.find + $sort',
  '.find + $sort + string',
  '.find + $limit',
  '.find + $limit 0',
  '.find + $skip',
  '.find + $select',
  '.find + $or',
  '.find + $in',
  '.find + $nin',
  '.find + $lt',
  '.find + $lte',
  '.find + $gt',
  '.find + $gte',
  '.find + $ne',
  '.find + $gt + $lt + $sort',
  '.find + $or nested + $sort',
  '.find + paginate',
  '.find + paginate + $limit + $skip',
  '.find + paginate + $limit 0',
  '.find + paginate + params',
  '.get + id + query id',
  '.remove + id + query id',
  '.update + id + query id',
  '.patch + id + query id'
]);

describe('Feathers MongoDB Service', () => {
  const app = feathers();

  let db;
  let mongoClient;

  before(() =>
    MongoClient.connect('mongodb://localhost:27017/feathers-test', {
      useNewUrlParser: true
    }).then(function (client) {
      mongoClient = client;
      db = client.db('feathers-test');

      app.use('/people', service({
        events: ['testing']
      })).use('/people-customid', service({
        Model: db.collection('people-customid'),
        id: 'customid',
        events: ['testing']
      }));

      app.service('people').Model = db.collection('people');

      db.collection('people-customid').removeMany();
      db.collection('people').removeMany();
      db.collection('todos').removeMany();

      db.collection('people').createIndex(
        { name: 1 },
        { partialFilterExpression: { team: 'blue' } }
      );
    })
  );

  after(() => db.dropDatabase().then(() => mongoClient.close()));

  it('is CommonJS compatible', () =>
    expect(typeof require('../lib')).to.equal('function')
  );

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
        expect(result.query).to.deep.equal(Object.assign({}, params.query, { $and: [{ _id: id }] }));
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
      const projectFields = { name: 1, age: 1 };
      const selectFields = ['name', 'age'];

      it('returns Mongo project object when an array is passed', () => {
        const result = service({ Model: db })._getSelect(selectFields);
        expect(result).to.be.an('object');
        expect(result).to.deep.equal(projectFields);
      });

      it('returns original object', () => {
        const result = service({ Model: db })._getSelect(projectFields);
        expect(result).to.be.an('object');
        expect(result).to.deep.equal(projectFields);
      });
    });
  });

  describe('Special collation param', () => {
    let peopleService, people;

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

    beforeEach(async () => {
      peopleService = app.service('/people');
      peopleService.options.multi = true;
      people = await Promise.all([
        peopleService.create({ name: 'AAA' }),
        peopleService.create({ name: 'aaa' }),
        peopleService.create({ name: 'ccc' })
      ]);
    });

    afterEach(async () => {
      peopleService.options.multi = false;
      await Promise.all([
        peopleService.remove(people[0]._id),
        peopleService.remove(people[1]._id),
        peopleService.remove(people[2]._id)
      ]).catch(() => {});
    });

    it('should coerce the id field to an objectId in find', async () => {
      const person = await peopleService.create({ name: 'Coerce' });
      const results = await peopleService.find({
        query: {
          _id: person._id.toString()
        }
      });

      expect(results).to.have.lengthOf(1);

      await peopleService.remove(person._id);
    });

    it('sorts with default behavior without collation param', async () => {
      const results = await peopleService.find({ query: { $sort: { name: -1 } } });

      expect(indexOfName(results, 'aaa')).to.be.below(indexOfName(results, 'AAA'));
    });

    it.skip('sorts using collation param if present', async () => {
      const results = await peopleService.find({
        query: { $sort: { name: -1 } },
        collation: { locale: 'en', strength: 1 }
      });

      expect(indexOfName(results, 'AAA')).to.be.below(indexOfName(results, 'aaa'));
    });

    it('removes with default behavior without collation param', async () => {
      await peopleService.remove(null, { query: { name: { $gt: 'AAA' } } });

      const results = await peopleService.find();

      expect(results).to.have.lengthOf(1);
      expect(results[0].name).to.equal('AAA');
    });

    it('removes using collation param if present', async () => {
      await peopleService.remove(null, {
        query: { name: { $gt: 'AAA' } },
        collation: { locale: 'en', strength: 1 }
      });

      const results = await peopleService.find();

      expect(results).to.have.lengthOf(3);
    });

    it('updates with default behavior without collation param', async () => {
      const query = { name: { $gt: 'AAA' } };

      const result = await peopleService.patch(null, { age: 99 }, { query });

      expect(result).to.have.lengthOf(2);
      result.forEach(person => {
        expect(person.age).to.equal(99);
      });
    });

    it('updates using collation param if present', async () => {
      const result = await peopleService.patch(null, { age: 110 }, {
        query: { name: { $gt: 'AAA' } },
        collation: { locale: 'en', strength: 1 }
      });

      expect(result).to.have.lengthOf(1);
      expect(result[0].name).to.equal('ccc');
    });

    it('pushes to an array using patch', async () => {
      const result = await peopleService.patch(null, { $push: { friends: 'Adam' } }, {
        query: { name: { $gt: 'AAA' } }
      });

      expect(result[0].friends).to.have.lengthOf(1);

      const patched = await peopleService.patch(null, {
        $push: { friends: 'Bell' }
      }, { query: { name: { $gt: 'AAA' } } });

      expect(patched[0].friends).to.have.lengthOf(2);
    });

    it('overrides default index selection using hint param if present', async () => {
      const indexed = await peopleService.create({ name: 'Indexed', team: 'blue' });

      const result = await peopleService.find({ query: { }, hint: { name: 1 } });

      expect(result).to.have.lengthOf(1);

      await peopleService.remove(indexed._id);
    });
  });

  testSuite(app, errors, 'people', '_id');
  testSuite(app, errors, 'people-customid', 'customid');
});
