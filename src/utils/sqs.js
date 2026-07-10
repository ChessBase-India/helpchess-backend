const config = require('config');
const { Producer } = require('sqs-producer');

// Add one producer per queue your service publishes to.
const exampleEventsProducer = Producer.create({
  queueUrl: config.get('exampleQueue.url'),
  region: config.get('exampleQueue.region')
});

module.exports = { exampleEventsProducer };
