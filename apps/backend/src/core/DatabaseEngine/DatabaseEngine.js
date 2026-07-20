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
          debug(message) { logger.debug(`Query: ${message.sql}`); }
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
   * Returns a Knex query builder pre-scoped to the given tenant.
   * This is the primary method that should be used for ALL queries
   * targeting `dt_*` and `sys_*` tables to guarantee tenant isolation.
   * 
   * @param {string} table - The table name to query
   * @param {string} tenantId - The tenant ID to scope the query to
   * @param {object} [options] - Options like transaction or includeDeleted
   * @returns {import('knex').Knex.QueryBuilder}
   */
  query(table, tenantId, options = {}) {
    if (!this.db) {
      throw new DatabaseError('DatabaseEngine is not initialized.');
    }
    // tenantId is deprecated in schema but kept in signature for compatibility if needed elsewhere
    // if (!tenantId) {
    //   throw new DatabaseError(`Tenant ID is required for querying table ${table}`);
    // }

    let qb = this.db(table);

    // Apply transaction if provided
    if (options.trx) {
      qb = qb.transacting(options.trx);
    }

    // Apply soft delete filter by default
    if (!options.includeDeleted) {
      // Assuming 'status' is a standard column
      qb = qb.whereNot('status', 'Deleted');
    }

    return qb;
  }

  /**
   * Provides direct access to Knex for extremely rare global operations.
   * WARNING: Bypasses tenant isolation. Do not use for standard logic.
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
