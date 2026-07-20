import Redis from 'ioredis';
import { config } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

class CacheEngine {
  constructor() {
    this.cache = new Map();
    this.isConnected = true; // Always true for in-memory
  }

  /**
   * Initializes the Cache connection (No-op for in-memory).
   */
  async init() {
    logger.info('Initializing In-Memory Cache Engine...');
    this.isConnected = true;
  }

  /**
   * Gets a value from cache and parses it as JSON.
   * @param {string} key 
   * @returns {Promise<any>}
   */
  async get(key) {
    if (!this.isConnected) return null;
    try {
      const entry = this.cache.get(key);
      if (!entry) return null;
      
      // Check expiration
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        this.cache.delete(key);
        return null;
      }
      
      return JSON.parse(entry.data);
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
      const expiresAt = Date.now() + (ttlSeconds * 1000);
      this.cache.set(key, { data, expiresAt });
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
      this.cache.delete(key);
    } catch (err) {
      logger.error(`CacheEngine DEL error for key ${key}:`, err);
    }
  }

  /**
   * Clears all cache.
   */
  async flushAll() {
    this.cache.clear();
  }

  /**
   * Gracefully close connection.
   */
  async close() {
    this.cache.clear();
    this.isConnected = false;
    logger.info('In-Memory Cache Engine closed.');
  }
}

// Export as Singleton instance
const instance = new CacheEngine();
export default instance;
