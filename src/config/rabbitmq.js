require('dotenv').config();

module.exports = {
  url: process.env.RABBITMQ_URL || null,
  queues: {
    EMAIL_QUEUE: 'email_queue',
  }
};
