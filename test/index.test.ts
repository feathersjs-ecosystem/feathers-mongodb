import { Db, MongoClient, ObjectId } from 'mongodb'
import adapterTests from '@feathersjs/adapter-tests'
import assert from 'assert'

import { feathers } from '@feathersjs/feathers'
import errors from '@feathersjs/errors'
import { MongoDBService } from '../src'

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
  '.get + id + query id',
  '.find',
  '.find + paginate + query',
  '.remove',
  '.remove + $select',
  '.remove + id + query',
  '.remove + multi',
  '.remove + multi no pagination',
  '.remove + id + query id',
  '.update',
  '.update + $select',
  '.update + id + query',
  '.update + NotFound',
  '.update + id + query id',
  '.update + query + NotFound',
  '.patch',
  '.patch + $select',
  '.patch + id + query',
  '.patch multiple',
  '.patch multiple no pagination',
  '.patch multi query same',
  '.patch multi query changed',
  '.patch + query + NotFound',
  '.patch + NotFound',
  '.patch + id + query id',
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
  'params.adapter + paginate',
  'params.adapter + multi'
])

describe('Feathers MongoDB Service', () => {
  type Person = {
    _id: string
    name: string
    age: number
  }

  type ServiceTypes = {
    people: MongoDBService<Person>,
    'people-customid': MongoDBService<Person>,
    'people-estimated-count': MongoDBService<Person>
  }

  const app = feathers<ServiceTypes>()

  let db: Db
  let mongoClient: MongoClient

  before(async () => {
    const client = await MongoClient.connect('mongodb://localhost:27017/feathers-test')

    mongoClient = client
    db = client.db('feathers-test')

    app.use('people', new MongoDBService({
      Model: db.collection('people-customid'),
      events: ['testing']
    }))
    app.use('people-customid', new MongoDBService({
      Model: db.collection('people-customid'),
      id: 'customid',
      events: ['testing']
    }))
    
    app.use('people-estimated-count', new MongoDBService({
      Model: db.collection('people-estimated-count'),
      events: ['testing'],
      useEstimatedDocumentCount: true
    }))

    app.service('people').Model = db.collection('people')

    db.collection('people-customid').deleteMany({})
    db.collection('people').deleteMany({})
    db.collection('todos').deleteMany({})

    db.collection('people').createIndex(
      { name: 1 },
      { partialFilterExpression: { team: 'blue' } }
    )
  })

  after(async () => {
    await db.dropDatabase();
    await mongoClient.close();
  })

  describe('Service utility functions', () => {
    describe('objectifyId', () => {
      it('returns an ObjectID instance for a valid ID', () => {
        const id = new ObjectId()
        const objectify = app.service('people')._objectifyId(id.toString())

        assert.ok(objectify instanceof ObjectId)
        assert.strictEqual(objectify, id)
      })

      it('returns an ObjectID instance for a valid ID', () => {
        const id = 'non-valid object id'
        const objectify = app.service('people')._objectifyId(id.toString())

        assert.ok(!(objectify instanceof ObjectId))
        assert.strictEqual(objectify, id)
      })
    })

    describe('_multiOptions', () => {
      const params = {
        query: {
          age: 21
        },
        options: {
          limit: 5
        }
      }

      it('returns valid result when passed an ID', () => {
        const id = new ObjectId()
        const result = app.service('people')._multiOptions(id, params)

        assert.deepStrictEqual(result.query, {
          ...params.query,
          $and: [{ _id: id }]
        })
        assert.deepStrictEqual(result.options, {
          ...params.options,
          multi: false
        })
      })

      it('returns original object', () => {
        const id = new ObjectId()
        const result = app.service('people')._multiOptions(id, params)

        assert.deepStrictEqual(result.query, params.query)
        assert.deepStrictEqual(result.options, {
          ...params.options,
          multi: true
        })
      })
    })

    describe('_options', () => {
      const params = {
        query: {
          age: 21
        },
        options: {
          limit: 5
        }
      }

      it('returns original object', () => {
        const result = app.service('people')._options(params)

        assert.deepStrictEqual(result.options, params.options)
      })
    })

    describe('getSelect', () => {
      const projectFields = { name: 1, age: 1 }
      const selectFields = ['name', 'age']

      it('returns Mongo project object when an array is passed', () => {
        const result = app.service('people')._getSelect(selectFields)
        
        assert.deepStrictEqual(result, projectFields)
      })

      it('returns original object', () => {
        const result = app.service('people')._getSelect(projectFields)
        
        assert.deepStrictEqual(result, projectFields)
      })
    })
  })

  // describe('Special collation param', () => {
  //   let peopleService: MongoDBService<Person>, people

  //   function indexOfName (results, name) {
  //     let index
  //     results.every(function (person, i) {
  //       if (person.name === name) {
  //         index = i
  //         return false
  //       }
  //       return true
  //     })
  //     return index
  //   }

  //   beforeEach(async () => {
  //     peopleService = app.service('people')
  //     peopleService.options.multi = true
  //     peopleService.options.disableObjectify = true
  //     people = await peopleService.create([
  //       { name: 'AAA' }, { name: 'aaa' }, { name: 'ccc' }
  //     ])
  //   })

  //   afterEach(async () => {
  //     peopleService.options.multi = false
  //     await Promise.all([
  //       peopleService.remove(people[0]._id),
  //       peopleService.remove(people[1]._id),
  //       peopleService.remove(people[2]._id)
  //     ]).catch(() => {})
  //   })

  //   it('queries for ObjectId in find', async () => {
  //     const person = await peopleService.create({ name: 'Coerce' })
  //     const results = await peopleService.find({
  //       query: {
  //         _id: new ObjectId(person._id)
  //       }
  //     })

  //     assert.strictEqual(results.length, 1)

  //     await peopleService.remove(person._id)
  //   })

  //   it('works with normal string _id', async () => {
  //     const person = await peopleService.create({
  //       _id: 'lessonKTDA08',
  //       name: 'Coerce'
  //     })
  //     const result = await peopleService.get(person._id)

  //     assert.strictEqual(result.name, 'Coerce')

  //     await peopleService.remove(person._id)
  //   })

  //   it('sorts with default behavior without collation param', async () => {
  //     const results = await peopleService.find({ query: { $sort: { name: -1 } } })

  //     assert.ok(indexOfName(results, 'aaa') < indexOfName(results, 'AAA'))
  //   })

  //   it.skip('sorts using collation param if present', async () => {
  //     const results = await peopleService.find({
  //       query: { $sort: { name: -1 } },
  //       collation: { locale: 'en', strength: 1 }
  //     })

  //     assert.ok(indexOfName(results, 'aaa') > indexOfName(results, 'AAA'))
  //   })

  //   it('removes with default behavior without collation param', async () => {
  //     await peopleService.remove(null, { query: { name: { $gt: 'AAA' } } })

  //     const results = await peopleService.find()

  //     assert.strictEqual(results.length, 1)
  //     assert.strictEqual(results[0].name, 'AAA')
  //   })

  //   it('removes using collation param if present', async () => {
  //     await peopleService.remove(null, {
  //       query: { name: { $gt: 'AAA' } },
  //       collation: { locale: 'en', strength: 1 }
  //     })

  //     const results = await peopleService.find()

  //     assert.strictEqual(results.length, 3)
  //   })

  //   it('updates with default behavior without collation param', async () => {
  //     const query = { name: { $gt: 'AAA' } }

  //     const result = await peopleService.patch(null, { age: 99 }, { query })

  //     assert.strictEqual(result.length, 2)
  //     result.forEach(person => {
  //       assert.strictEqual(person.age, 99)
  //     })
  //   })

  //   it('updates using collation param if present', async () => {
  //     const result = await peopleService.patch(null, { age: 110 }, {
  //       query: { name: { $gt: 'AAA' } },
  //       collation: { locale: 'en', strength: 1 }
  //     })

  //     assert.strictEqual(result.length, 1)
  //     assert.strictEqual(result[0].name, 'ccc')
  //   })

  //   it('pushes to an array using patch', async () => {
  //     const result = await peopleService.patch(null, { $push: { friends: 'Adam' } }, {
  //       query: { name: { $gt: 'AAA' } }
  //     })

  //     assert.strictEqual(result[0].friends.length, 1)

  //     const patched = await peopleService.patch(null, {
  //       $push: { friends: 'Bell' }
  //     }, { query: { name: { $gt: 'AAA' } } })

  //     assert.strictEqual(patched[0].friends.length, 2)
  //   })

  //   it('overrides default index selection using hint param if present', async () => {
  //     const indexed = await peopleService.create({ name: 'Indexed', team: 'blue' })

  //     const result = await peopleService.find({ query: { }, hint: { name: 1 } })

  //     assert.strictEqual(result.length, 1)

  //     await peopleService.remove(indexed._id)
  //   })
  // })

  testSuite(app, errors, 'people', '_id')
  testSuite(app, errors, 'people-customid', 'customid')
  testSuite(app, errors, 'people-estimated-count', '_id')
})
