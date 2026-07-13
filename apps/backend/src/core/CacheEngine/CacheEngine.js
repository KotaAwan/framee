import Redis from 'ioredis';
import { config } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

class CacheEngine {
  constructor() {
    this.redis = null;
    this.isConnected = false;
  }

  /**
   * Initializes the Redis connection.
   */
  async init() {
    if (this.redis) return;

    logger.info('Initializing Cache Engine...');

    this.redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      // Retry strategy
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      }
    });

    return new Promise((resolve, reject) => {
      this.redis.on('connect', () => {
        this.isConnected = true;
        logger.info('Cache Engine connected successfully to Redis.');
        resolve();
      });

      this.redis.on('error', (err) => {
        logger.error('Redis connection error:', err);
        // Do not reject here so the app can still start without Redis (if fallback is implemented)
        // But for Framee, metadata requires cache. We log it.
      });
    });
  }

  /**
   * Gets a value from cache and parses it as JSON.
   * @param {string} key 
   * @returns {Promise<any>}
   */
  async get(key) {
    if (!this.isConnected) return null;
    try {
      const data = await this.redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (err) {
      logger.error(`CacheEngine GET error for key ${key}:`, err);
      return null;
    }
  }

  /**
   * Sets a value in cache as JSON with an optional TTL (in seconds).
   * @param {string} key 
   * @param {any} value 
   * @param {number} [ttlSeconds=3600] 
   */
  async set(key, value, ttlSeconds = 3600) {
    if (!this.isConnected) return;
    try {
      const data = JSON.stringify(value);
      await this.redis.set(key, data, 'EX', ttlSeconds);
    } catch (err) {
      logger.error(`CacheEngine SET error for key ${key}:`, err);
    }
  }

  /**
   * Deletes a specific key from cache.
   * @param {string} key 
   */
  async del(key) {
    if (!this.isConnected) return;
    try {
      await this.redis.del(key);
    } catch (err) {
      logger.error(`CacheEngine DEL error for key ${key}:`, err);
    }
  }

  /**
   * Gracefully close connection.
   */
  async close() {
    if (this.redis) {
      await this.redis.quit();
      this.isConnected = false;
      logger.info('Cache Engine connection closed.');
    }
  }
}

// Export as Singleton instance
const instance = new CacheEngine();
export default instance;
