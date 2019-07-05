import { MongoClient } from 'mongodb';
import { default as mongodb, Service } from 'feathers-mongodb';

MongoClient.connect('mongodb://localhost:27017/feathers').then(client => {
  const service1 = mongodb({
    Model: client.db('feathers').collection('messages')
  });

  const service2 = new Service({
    Model: client.db('feathers').collection('messages'),
    events: ['test']
  });

  service2._get(2);

  service1.Model = client.db('feathers').collection('messages');
});
