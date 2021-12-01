import { expect } from "chai";
import { MongoClient, ObjectId } from "mongodb";
import adapterTests from "@feathersjs/adapter-tests";
import {
  feathers,
  Application as FeathersApplication,
} from "@feathersjs/feathers";
import { errors } from "@feathersjs/errors";
import { Service, mongodb } from "../src";

export type ServiceTypes = {
  people: Service;
  "people-customid": Service;
  "people-estimated-count": Service;
};
export type Configuration = {
  paginate: {
    default: number;
    max: number;
  };
};
type Application = FeathersApplication<ServiceTypes, Configuration>;

const tests = [
  ".options",
  ".events",
  "._get",
  "._find",
  "._create",
  "._update",
  "._patch",
  "._remove",
  ".get",
  ".get + $select",
  ".get + id + query",
  ".get + NotFound",
  ".find",
  ".remove",
  ".remove + $select",
  ".remove + id + query",
  ".remove + multi",
  ".update",
  ".update + $select",
  ".update + id + query",
  ".update + NotFound",
  ".update + query + NotFound",
  ".patch",
  ".patch + $select",
  ".patch + id + query",
  ".patch multiple",
  ".patch multi query changed",
  ".patch + NotFound",
  ".patch multi query same",
  ".patch + query + NotFound",
  ".create",
  ".create + $select",
  ".create multi",
  "internal .find",
  "internal .get",
  "internal .create",
  "internal .update",
  "internal .patch",
  "internal .remove",
  ".find + equal",
  ".find + equal multiple",
  ".find + $sort",
  ".find + $sort + string",
  ".find + $limit",
  ".find + $limit 0",
  ".find + $skip",
  ".find + $select",
  ".find + $or",
  ".find + $in",
  ".find + $nin",
  ".find + $lt",
  ".find + $lte",
  ".find + $gt",
  ".find + $gte",
  ".find + $ne",
  ".find + $gt + $lt + $sort",
  ".find + $or nested + $sort",
  ".find + paginate",
  ".find + paginate + query",
  ".find + paginate + $limit + $skip",
  ".find + paginate + $limit 0",
  ".find + paginate + params",
  ".get + id + query id",
  ".remove + id + query id",
  ".update + id + query id",
  ".patch + id + query id",
  "params.adapter + paginate",
  "params.adapter + multi",
];
const testSuite = adapterTests(tests);

// The estimated count returns incorrect pagination total for the `.find + paginate + query` test.
const limitedTestSuite = adapterTests(
  tests.filter((test: string) => test !== ".find + paginate + query")
);

describe("Feathers MongoDB Service", () => {
  const app: Application = feathers();

  let db: any;
  let mongoClient: MongoClient;

  before(async () => {
    const client = await MongoClient.connect(
      "mongodb://localhost:27017/feathers-test"
    );

    mongoClient = client;
    db = client.db("feathers-test");

    app
      .use(
        "people",
        mongodb({
          id: "_id",
          events: ["testing"],
          multi: false,
          Model: db.collection("people"),
          paginate: app.get("paginate"),
          whitelist: ["$regex", "$options", "$and", "$or", "$elemMatch"],
          allow: [],
          filters: [],
        })
      )
      .use(
        "people-customid",
        mongodb({
          Model: db.collection("people-customid"),
          id: "customid",
          events: ["testing"],
          multi: false,
          paginate: app.get("paginate"),
          whitelist: ["$regex", "$options", "$and", "$or", "$elemMatch"],
          allow: [],
          filters: [],
        })
      )
      .use(
        "people-estimated-count",
        mongodb({
          id: "_id",
          Model: db.collection("people-estimated-count"),
          events: ["testing"],
          useEstimatedDocumentCount: true,
          multi: false,
          paginate: app.get("paginate"),
          whitelist: ["$regex", "$options", "$and", "$or", "$elemMatch"],
          allow: [],
          filters: [],
        })
      );

    app.service("people").Model = db.collection("people");

    await db.collection("people-customid").deleteMany();
    await db.collection("people").deleteMany();
    await db.collection("todos").deleteMany();

    await db
      .collection("people")
      .createIndex({ name: 1 }, { partialFilterExpression: { team: "blue" } });
  });

  after(() => db.dropDatabase().then(() => mongoClient.close()));

  it("is CommonJS compatible", () => {
    const mod = require("../lib");
    expect(typeof mod.mongodb).to.equal("function");
    expect(typeof mod.Service).to.equal("function");
  });

  describe("Initialization", () => {
    describe("when missing the id option", () => {
      it("sets the default to be _id", () =>
        expect(mongodb({ Model: db }).id).to.equal("_id"));
    });
  });

  describe("Service utility functions", () => {
    describe("objectifyId", () => {
      it("returns an ObjectID instance for a valid ID", () => {
        const id = new ObjectId();
        const result = mongodb({ Model: db })._objectifyId(id.toString());
        expect(result).to.be.instanceof(ObjectId);
        expect(result).to.deep.equal(id);
      });

      it("does not return an ObjectID instance for an invalid ID", () => {
        const id = "non-valid object id";
        const result = mongodb({ Model: db })._objectifyId(id.toString());
        expect(result).to.not.be.instanceof(ObjectId);
        expect(result).to.deep.equal(id);
      });
    });

    describe("_multiOptions", () => {
      const params = {
        query: {
          age: 21,
        },
        options: {
          limit: 5,
        },
      };

      it("returns valid result when passed an ID", () => {
        const id = new ObjectId();
        const result = mongodb({ Model: db })._multiOptions(id, params);
        expect(result).to.be.an("object");
        expect(result).to.include.all.keys(["query", "options"]);
        expect(result.query).to.deep.equal(
          Object.assign({}, params.query, { $and: [{ _id: id }] })
        );
        expect(result.options).to.deep.equal(
          Object.assign({}, params.options, { multi: false })
        );
      });

      it("returns original object", () => {
        const result = mongodb({ Model: db })._multiOptions(null, params);
        expect(result).to.be.an("object");
        expect(result).to.include.all.keys(["query", "options"]);
        expect(result.query).to.deep.equal(params.query);
        expect(result.options).to.deep.equal(
          Object.assign({}, params.options, { multi: true })
        );
      });
    });

    describe("_options", () => {
      const params = {
        query: {
          age: 21,
        },
        options: {
          limit: 5,
        },
      };

      it("returns original object", () => {
        const result = mongodb({ Model: db })._options(params);
        expect(result).to.be.an("object");
        expect(result).to.include.all.keys([
          "options",
          "filters",
          "query",
          "paginate",
        ]);
        expect(result.query).to.deep.equal(params.query);
        expect(result.options).to.deep.equal(Object.assign({}, params.options));
      });
    });

    describe("getSelect", () => {
      const projectFields = { name: 1, age: 1 };
      const selectFields = ["name", "age"];

      it("returns Mongo project object when an array is passed", () => {
        const result = mongodb({ Model: db })._getSelect(selectFields);
        expect(result).to.be.an("object");
        expect(result).to.deep.equal(projectFields);
      });

      it("returns original object", () => {
        const result = mongodb({ Model: db })._getSelect(projectFields);
        expect(result).to.be.an("object");
        expect(result).to.deep.equal(projectFields);
      });
    });
  });

  describe("Special collation param", () => {
    let peopleService: any;
    let people: any;

    function indexOfName(results: any, name: string) {
      let index: any;
      results.every(function (person: any, i: any) {
        if (person.name === name) {
          index = i;
          return false;
        }
        return true;
      });
      return index;
    }

    beforeEach(async () => {
      peopleService = app.service("people");
      peopleService.options.multi = true;
      peopleService.options.disableObjectify = true;
      people = await peopleService.create([
        { name: "AAA" },
        { name: "aaa" },
        { name: "ccc" },
      ]);
    });

    afterEach(async () => {
      peopleService.options.multi = false;
      await Promise.all([
        peopleService.remove(people[0]._id),
        peopleService.remove(people[1]._id),
        peopleService.remove(people[2]._id),
      ]).catch(() => {});
    });

    it("queries for ObjectId in find", async () => {
      const person = await peopleService.create({ name: "Coerce" });
      const results = await peopleService.find({
        query: {
          _id: new ObjectId(person._id),
        },
      });

      expect(results).to.have.lengthOf(1);

      await peopleService.remove(person._id);
    });

    it("works with normal string _id", async () => {
      const person = await peopleService.create({
        _id: "lessonKTDA08",
        name: "Coerce",
      });
      const result = await peopleService.get(person._id);

      expect(result.name).to.equal("Coerce");

      await peopleService.remove(person._id);
    });

    it("sorts with default behavior without collation param", async () => {
      const results = await peopleService.find({
        query: { $sort: { name: -1 } },
      });

      expect(indexOfName(results, "aaa")).to.be.below(
        indexOfName(results, "AAA")
      );
    });

    it.skip("sorts using collation param if present", async () => {
      const results = await peopleService.find({
        query: { $sort: { name: -1 } },
        collation: { locale: "en", strength: 1 },
      });

      expect(indexOfName(results, "AAA")).to.be.below(
        indexOfName(results, "aaa")
      );
    });

    it("removes with default behavior without collation param", async () => {
      await peopleService.remove(null, { query: { name: { $gt: "AAA" } } });

      const results = await peopleService.find();

      expect(results).to.have.lengthOf(1);
      expect(results[0].name).to.equal("AAA");
    });

    it("removes using collation param if present", async () => {
      await peopleService.remove(null, {
        query: { name: { $gt: "AAA" } },
        collation: { locale: "en", strength: 1 },
      });

      const results = await peopleService.find();

      expect(results).to.have.lengthOf(3);
    });

    it("updates with default behavior without collation param", async () => {
      const query = { name: { $gt: "AAA" } };

      const result = await peopleService.patch(null, { age: 99 }, { query });

      expect(result).to.have.lengthOf(2);
      result.forEach((person: any) => {
        expect(person.age).to.equal(99);
      });
    });

    it("updates using collation param if present", async () => {
      const result = await peopleService.patch(
        null,
        { age: 110 },
        {
          query: { name: { $gt: "AAA" } },
          collation: { locale: "en", strength: 1 },
        }
      );

      expect(result).to.have.lengthOf(1);
      expect(result[0].name).to.equal("ccc");
    });

    it("pushes to an array using patch", async () => {
      const result = await peopleService.patch(
        null,
        { $push: { friends: "Adam" } },
        {
          query: { name: { $gt: "AAA" } },
        }
      );

      expect(result[0].friends).to.have.lengthOf(1);

      const patched = await peopleService.patch(
        null,
        {
          $push: { friends: "Bell" },
        },
        { query: { name: { $gt: "AAA" } } }
      );

      expect(patched[0].friends).to.have.lengthOf(2);
    });

    it("overrides default index selection using hint param if present", async () => {
      const indexed = await peopleService.create({
        name: "Indexed",
        team: "blue",
      });

      const result = await peopleService.find({ query: {}, hint: { name: 1 } });

      expect(result).to.have.lengthOf(1);

      await peopleService.remove(indexed._id);
    });
  });

  testSuite(app, errors, "people", "_id");
  testSuite(app, errors, "people-customid", "customid");
  limitedTestSuite(app, errors, "people-estimated-count", "_id");
});
