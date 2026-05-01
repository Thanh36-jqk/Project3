require('dotenv').config();

module.exports = {
  url: process.env.RABBITMQ_URL || 'amqp://localhost',
  queues: {
    EMAIL_QUEUE: 'email_queue',
  }
};
