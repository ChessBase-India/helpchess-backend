require('app-module-path').addPath(require('path').resolve(__dirname));
require('models/db');
require('dotenv-safe').config({ allowEmptyValues: true });

const { Consumer } = require('sqs-consumer');
const { SQSClient } = require('@aws-sdk/client-sqs');
const https = require('https');
const config = require('config');
const gracefulShutdown = require('http-graceful-shutdown');

const exampleEvents = require('services/exampleEvents');
const logger = require('utils/logger');
const winstonLogger = require('utils/winstonLogger');

const app = Consumer.create({
  queueUrl: config.get('exampleQueue.url'),
  handleMessage: async (message) => {
    await exampleEvents.processEvent({ event: message });
  },
  sqs: new SQSClient({
    region: config.get('exampleQueue.region'),
    httpOptions: {
      agent: new https.Agent({
        keepAlive: true
      })
    }
  })
});

app.on('started', () => {
  logger.info('Example events consumer started.');
});

app.on('stopped', () => {
  logger.info('Example events consumer stopped.');
});

app.on('error', (err) => {
  logger.error(err.message);
});

app.on('processing_error', (err) => {
  logger.alert(err.message);
});

const shutdownCleanup = async (signal) => {
  logger.info(`Received ${signal}, shutting down example events consumer...`);

  app.stop();

  // eslint-disable-next-line no-promise-executor-return
  const loggerDone = new Promise((resolve) => winstonLogger.on('finish', resolve));
  winstonLogger.end();

  return loggerDone;
};

gracefulShutdown(app, {
  onShutdown: shutdownCleanup,
  timeout: 5000
});

process.on('unhandledRejection', (err) => {
  logger.error(err);
  process.exit(1);
});

app.start();
