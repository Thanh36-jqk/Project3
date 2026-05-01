const amqp = require('amqplib');
const rabbitmqConfig = require('../config/rabbitmq');

let connection = null;
let channel = null;

const connectRabbitMQ = async () => {
    try {
        if (!rabbitmqConfig.url) {
            console.warn('RabbitMQ URL not found in environment. Skipping connection.');
            return;
        }
        connection = await amqp.connect(rabbitmqConfig.url);
        channel = await connection.createChannel();
        console.log('RabbitMQ connected successfully');

        // Assert queues to ensure they exist
        for (const queueName of Object.values(rabbitmqConfig.queues)) {
            await channel.assertQueue(queueName, { durable: true });
        }
    } catch (error) {
        console.error('RabbitMQ connection error:', error.message);
        // It's up to you if you want to exit the process or retry
        // process.exit(1);
    }
};

const publishToQueue = async (queueName, data) => {
    try {
        if (!channel) {
            console.warn('RabbitMQ channel not initialized. Attempting to connect...');
            await connectRabbitMQ();
        }
        
        if (channel) {
            const message = JSON.stringify(data);
            channel.sendToQueue(queueName, Buffer.from(message), {
                persistent: true
            });
            console.log(`Message sent to queue ${queueName}`);
            return true;
        } else {
            throw new Error('Failed to establish RabbitMQ connection for publishing');
        }
    } catch (error) {
        console.error(`Error publishing to queue ${queueName}:`, error.message);
        return false;
    }
};

const consumeFromQueue = async (queueName, callback) => {
    try {
        if (!channel) {
            await connectRabbitMQ();
        }

        if (channel) {
            console.log(`Waiting for messages in queue: ${queueName}`);
            channel.consume(queueName, async (msg) => {
                if (msg !== null) {
                    try {
                        const content = JSON.parse(msg.content.toString());
                        await callback(content);
                        channel.ack(msg); // Acknowledge successful processing
                    } catch (error) {
                        console.error(`Error processing message from queue ${queueName}:`, error.message);
                        // Depending on requirements, we can nack the message to requeue it
                        // channel.nack(msg, false, false);
                    }
                }
            }, { noAck: false });
        }
    } catch (error) {
        console.error(`Error consuming from queue ${queueName}:`, error.message);
    }
};

module.exports = {
    connectRabbitMQ,
    publishToQueue,
    consumeFromQueue
};
