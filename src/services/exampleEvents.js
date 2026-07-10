const logger = require('utils/logger');

module.exports = {
  /**
   * Handler for messages consumed from the example queue.
   * Replace with your actual event processing logic. Throwing here keeps
   * the message on the queue for redelivery (until the queue's redrive
   * policy moves it to a DLQ).
   */
  processEvent: async ({ event }) => {
    const body = JSON.parse(event.Body);
    logger.info(`Received example event: ${JSON.stringify(body)}`);
  }
};
