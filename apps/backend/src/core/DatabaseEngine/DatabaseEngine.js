import knex from 'knex';
import { logger } from '../../utils/logger.js';
import { DatabaseError } from '../../utils/errors.js';
import { config } from '../../config/env.js';

class DatabaseEngine {
  constructor() {
    this.db = null;
  }

  /**
   * Initializes the database connection pool.
   */
  async init() {
    if (this.db) return;

    logger.info('Initializing Database Engine...');
    
    try {
      this.db = knex({
        client: 'mysql2',
        debug: true,
        connection: {
          host: config.db.host,
          port: config.db.port,
          user: config.db.user,
          password: config.db.password,
          database: config.db.name,
          timezone: 'Z',
          decimalNumbers: true, // Return decimals as numbers, not strings
        },
        pool: {
          min: config.db.poolMin,
          max: config.db.poolMax,
        },
        // Log queries in debug mode
        log: {
          warn(message) { logger.warn(message); },
          error(message) { logger.error(message); },
          deprecate(message) { logger.warn(`Deprecated: ${message}`); },
          debug(message) { 
            console.log(`\x1b[36m[SQL Query]\x1b[0m ${message.sql} ${message.bindings ? ':: [' + message.bindings.join(', ') + ']' : ''}`);
          }
        }
      });

      // Test connection
      await this.db.raw('SELECT 1 as test_connection');
      logger.info('Database Engine connected successfully.');
    } catch (error) {
      logger.error('Failed to connect to database.', error);
      throw new DatabaseError('Database connection failed', error.message);
    }
  }

  /**
   * Returns a Knex query builder for the given table.
   * This is the primary method for ALL queries targeting `dt_*` and `sys_*` tables.
   * Multi-tenancy is not used — no tenant scoping is applied.
   * 
   * @param {string} table - The table name to query
   * @param {object} [options] - Options like includeDeleted
   * @returns {import('knex').Knex.QueryBuilder}
   */
  query(table, options = {}) {
    if (!this.db) {
      throw new DatabaseError('DatabaseEngine is not initialized.');
    }

    let qb = this.db(table);

    // Apply soft delete filter by default
    if (!options.includeDeleted) {
      qb = qb.whereNot('status', 'Deleted');
    }

    return qb;
  }

  /**
   * Provides direct access to Knex for raw operations (e.g. transactions, migrations).
   */
  getRawConnection() {
    if (!this.db) throw new DatabaseError('DatabaseEngine is not initialized.');
    return this.db;
  }

  /**
   * Safely destroys the connection pool.
   */
  async close() {
    if (this.db) {
      await this.db.destroy();
      this.db = null;
      logger.info('Database Engine connection closed.');
    }
  }
}

// Export as Singleton instance
const instance = new DatabaseEngine();
export default instance;
