import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger.js';
import Container from '../Container.js';
import { config } from '../../config/env.js';
import Redis from 'ioredis';
import Queue from 'bull';

/**
 * QueueEngine handles background job processing.
 * It uses Bull (Redis based) in production and a simple in-memory queue otherwise.
 */
class QueueEngine {
  constructor() {
    this.useRedis = config.redis && config.redis.url;
    this.queues = {}; // holds Bull instances or in-memory arrays
    this.handlers = {};
  }

  async init() {
    logger.info(`Initializing Queue Engine (Using ${this.useRedis ? 'Redis/Bull' : 'In-Memory'})...`);
    this.eventEngine = Container.resolve('EventEngine');
    
    // Example: Hook into EventEngine for sending emails in background
    this.eventEngine.on('email.send', (payload) => this.enqueue('email', payload));
  }

  _getQueue(queueName) {
    if (!this.queues[queueName]) {
      if (this.useRedis) {
        this.queues[queueName] = new Queue(queueName, config.redis.url);
        // Process if we already have a handler registered
        if (this.handlers[queueName]) {
          this.queues[queueName].process(this.handlers[queueName]);
        }
      } else {
        this.queues[queueName] = [];
      }
    }
    return this.queues[queueName];
  }

  /**
   * Add a job to the queue
   */
  async enqueue(queueName, payload, options = {}) {
    const queue = this._getQueue(queueName);
    
    if (this.useRedis) {
      const job = await queue.add(payload, options);
      logger.debug(`Job ${job.id} enqueued in ${queueName}`);
      return job.id;
    } else {
      const jobId = uuidv4();
      const job = { id: jobId, data: payload, options };
      queue.push(job);
      logger.debug(`Job ${jobId} enqueued in ${queueName} (in-memory)`);
      
      // Process asynchronously in next tick for in-memory
      if (this.handlers[queueName]) {
        setTimeout(() => this._processNextInMemory(queueName), 0);
      }
      return jobId;
    }
  }

  /**
   * Register a worker to process jobs in a queue
   */
  process(queueName, handler) {
    this.handlers[queueName] = async (jobData) => {
      // Wrapper to handle both Bull Job object and in-memory simple object
      const data = jobData.data || jobData; 
      try {
        await handler(data);
      } catch (err) {
        logger.error(`Job failed in queue ${queueName}:`, err);
        throw err;
      }
    };

    const queue = this._getQueue(queueName);
    if (this.useRedis) {
      queue.process(this.handlers[queueName]);
    } else {
      // Start processing existing in-memory jobs
      this._processNextInMemory(queueName);
    }
  }

  async _processNextInMemory(queueName) {
    const queue = this.queues[queueName];
    if (!queue || queue.length === 0) return;
    
    const handler = this.handlers[queueName];
    if (!handler) return;

    const job = queue.shift();
    if (job) {
      try {
        await handler(job);
      } catch (err) {
        // Simple retry mechanism could go here for in-memory
      } finally {
        // Process next
        if (queue.length > 0) {
          setTimeout(() => this._processNextInMemory(queueName), 0);
        }
      }
    }
  }
}

const instance = new QueueEngine();
export default instance;
