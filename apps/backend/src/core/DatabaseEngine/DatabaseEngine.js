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

    // Apply soft delete filter by default for tables with status tracking
    const tablesWithoutStatus = ['sys_docfield', 'sys_audit_log', 'sys_event_log'];
    if (!options.includeDeleted && !tablesWithoutStatus.includes(table)) {
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

  /**
   * Creates a database table for a DocType if it doesn't exist.
   * Maps DocField types to Knex schema builder types.
   */
  async createTableFromDocType(docType, fields) {
    const tableName = docType.table_name || `dt_${docType.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    
    // Create Main Table
    const exists = await this.db.schema.hasTable(tableName);
    if (!exists) {
      logger.info(`Creating table ${tableName} for DocType ${docType.name}...`);
      await this.db.schema.createTable(tableName, (table) => {
        // Standard Columns
        table.string('id', 36).primary();
        table.string('tenant_id', 36).notNullable().index();
        table.string('status', 20).defaultTo('Draft').index();
        table.string('created_by', 36);
        table.string('updated_by', 36);
        table.datetime('created_at');
        table.datetime('updated_at');
        table.datetime('deleted_at');
        table.string('deleted_by', 36);
        table.string('delete_reason', 255);
        table.string('amended_from', 36);
        
        if (docType.is_submittable) {
          table.datetime('submitted_at');
          table.string('submitted_by', 36);
          table.datetime('cancelled_at');
          table.string('cancelled_by', 36);
          table.string('cancel_reason', 255);
          table.string('workflow_state', 100).index();
        }

        if (docType.is_tree) {
          table.string('parent_id', 36).index();
          table.string('parent_field', 100);
          table.integer('idx'); // For sorting child rows
        }

        // Dynamic Columns from DocFields
        for (const field of fields) {
          if (field.fieldtype === 'Section Break' || field.fieldtype === 'Column Break' || field.fieldtype === 'Table') {
            continue; // Layout and child tables do not create columns
          }

          let col;
          switch (field.fieldtype) {
            case 'Data':
            case 'Select':
            case 'Password':
              col = table.string(field.fieldname, field.max_length || 255);
              break;
            case 'Link':
              col = table.string(field.fieldname, 36).index();
              break;
            case 'Int':
              col = table.integer(field.fieldname);
              break;
            case 'Float':
              col = table.decimal(field.fieldname, 18, 6);
              break;
            case 'Currency':
              col = table.decimal(field.fieldname, 18, 2);
              break;
            case 'Date':
              col = table.date(field.fieldname);
              break;
            case 'Datetime':
              col = table.datetime(field.fieldname);
              break;
            case 'Time':
              col = table.time(field.fieldname);
              break;
            case 'Text':
            case 'Attach':
              col = table.text(field.fieldname);
              break;
            case 'Long Text':
            case 'HTML':
              col = table.text(field.fieldname, 'longtext');
              break;
            case 'Check':
              col = table.boolean(field.fieldname).defaultTo(field.default_value === '1' || field.default_value === 'true' ? true : false);
              break;
            default:
              col = table.string(field.fieldname, 255);
          }

          if (field.is_unique) col.unique();
        }
      });
      logger.info(`Table ${tableName} created.`);
    }

    // Always ensure _logs and _likes tables exist (FR-003)
    const logsTableName = `${tableName}_logs`;
    const logsExists = await this.db.schema.hasTable(logsTableName);
    if (!logsExists) {
      await this.db.schema.createTable(logsTableName, (table) => {
        table.string('id', 36).primary();
        table.string('tenant_id', 36).notNullable().index();
        table.string('doc_id', 36).notNullable().index();
        table.string('action', 50); // e.g. 'Comment', 'Transition', 'Change'
        table.text('content');
        table.string('created_by', 36);
        table.string('user_name', 100);
        table.datetime('created_at');
      });
    }

    const likesTableName = `${tableName}_likes`;
    const likesExists = await this.db.schema.hasTable(likesTableName);
    if (!likesExists) {
      await this.db.schema.createTable(likesTableName, (table) => {
        table.string('tenant_id', 36).notNullable();
        table.string('doc_id', 36).notNullable();
        table.string('user_id', 36).notNullable();
        table.datetime('created_at');
        table.primary(['doc_id', 'user_id']); // composite primary key
      });
    }
  }
}

// Export as Singleton instance
const instance = new DatabaseEngine();
export default instance;
