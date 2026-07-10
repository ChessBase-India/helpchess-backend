require('dotenv-safe').config();
const mongoose = require('mongoose');
const config = require('config');
const logger = require('utils/logger');

mongoose
  .connect(config.get('mongoUrl'), {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    autoIndex: true
  })
  .then(() => {
    const entryPoint = require.main ? require.main.filename : 'Unknown entry point';
    logger.info(`Mongo Connected, connection initiated from: ${entryPoint}`);
  })
  .catch((err) => {
    logger.error(err);
    process.exit(-1);
  });
