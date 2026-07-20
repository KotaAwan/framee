import Container from '../Container.js';
import { logger } from '../../utils/logger.js';
import { FrameeError } from '../../utils/errors.js';

class SchemaEngine {
  constructor() {
    this.dbEngine = null;
    this.metaEngine = null;
  }

  init() {
    logger.info('Initializing Schema Engine...');
    this.dbEngine = Container.resolve('DatabaseEngine');
    this.metaEngine = Container.resolve('MetadataEngine');
    
    const eventEngine = Container.resolve('EventEngine');
    
    // Listen to DocType creation/updates
    eventEngine.on('sys_doctype.after_insert', this._handleDocTypeChange.bind(this));
    eventEngine.on('sys_doctype.after_update', this._handleDocTypeChange.bind(this));
    
    // Listen to DocField changes
    eventEngine.on('sys_docfield.after_insert', this._handleDocFieldChange.bind(this));
    eventEngine.on('sys_docfield.after_update', this._handleDocFieldChange.bind(this));
    eventEngine.on('sys_docfield.after_delete', this._handleDocFieldChange.bind(this));
  }

  async _handleDocTypeChange(payload, context) {
    if (!payload || !payload.name) return;
    try {
      await this.syncTable(payload.name, context.tenant_id);
    } catch (err) {
      logger.error(`Error in SchemaEngine on DocType change for ${payload.name}:`, err);
    }
  }

  async _handleDocFieldChange(payload, context) {
    if (!payload || !payload.doctype) return;
    try {
      // Find the doctype name
      const doctype = await this.dbEngine.query('sys_doctype', context.tenant_id)
        .where({ table_name: payload.doctype })
        .first();
      
      if (doctype) {
        // Invalidate meta cache before syncing
        const CACHE_PREFIX = 'framee:meta';
        const cacheEngine = Container.resolve('CacheEngine');
        await cacheEngine.del(`${CACHE_PREFIX}:${context.tenant_id}:${doctype.name}`);
        
        await this.syncTable(doctype.name, context.tenant_id);
      }
    } catch (err) {
      logger.error(`Error in SchemaEngine on DocField change for doctype ${payload.doctype}:`, err);
    }
  }

  /**
   * Maps Framee field types to Knex/SQL data types
   */
  _mapFieldType(table, field) {
    const { fieldname, fieldtype } = field;
    
    switch (fieldtype) {
      case 'Data':
      case 'Select':
      case 'Link':
      case 'Password':
        table.string(fieldname, 255);
        break;
      case 'Text':
      case 'Text Editor':
      case 'Code':
        table.text(fieldname);
        break;
      case 'Int':
        table.integer(fieldname);
        break;
      case 'Float':
      case 'Currency':
        table.decimal(fieldname, 20, 6);
        break;
      case 'Date':
        table.date(fieldname);
        break;
      case 'Datetime':
        table.datetime(fieldname);
        break;
      case 'Time':
        table.time(fieldname);
        break;
      case 'Check':
        table.boolean(fieldname).defaultTo(false);
        break;
      case 'JSON':
        table.json(fieldname);
        break;
      case 'Attach':
      case 'Attach Image':
        table.string(fieldname, 500); // URL or path
        break;
      case 'Section Break':
      case 'Column Break':
      case 'HTML':
        // These are UI-only fields, no DB column needed
        break;
      default:
        logger.warn(`Unknown fieldtype '${fieldtype}' for field '${fieldname}'. Falling back to VARCHAR(255)`);
        table.string(fieldname, 255);
    }
  }

  /**
   * Synchronizes the physical table schema for a given DocType.
   * If table doesn't exist, it creates it.
   * If it exists, it alters it (adds missing columns).
   * Note: This does NOT drop columns to prevent data loss.
   */
  async syncTable(doctypeName, tenantId) {
    logger.info(`Syncing table schema for DocType: ${doctypeName} (Tenant: ${tenantId})`);
    
    try {
      const meta = await this.metaEngine.getDocType(doctypeName, tenantId);
      const tableName = meta.table_name;
      
      const knex = this.dbEngine.getRawConnection();
      
      const exists = await knex.schema.hasTable(tableName);
      
      if (!exists) {
        await this._createTable(knex, tableName, meta);
      } else {
        await this._alterTable(knex, tableName, meta);
      }
      
      return true;
    } catch (error) {
      logger.error(`Failed to sync table for ${doctypeName}:`, error);
      throw new FrameeError('SCHEMA_SYNC_ERROR', `Failed to sync table schema: ${error.message}`);
    }
  }

  async _createTable(knex, tableName, meta) {
    logger.info(`Creating table: ${tableName}`);
    await knex.schema.createTable(tableName, (table) => {
      // 1. Standard Columns
      table.uuid('id').primary();
      table.uuid('tenant_id').notNullable();
      
      // 2. Dynamic DocFields
      for (const field of meta.fields) {
        this._mapFieldType(table, field);
      }
      
      // 3. Metadata & Lifecycle Columns
      table.string('status', 50).defaultTo('Active');
      table.uuid('created_by').nullable();
      table.uuid('updated_by').nullable();
      table.datetime('created_at').defaultTo(knex.fn.now());
      table.datetime('updated_at').defaultTo(knex.fn.now());
      
      if (meta.has_lifecycle) {
        table.string('workflow_state', 100).nullable();
        table.uuid('submitted_by').nullable();
        table.datetime('submitted_at').nullable();
        table.uuid('cancelled_by').nullable();
        table.datetime('cancelled_at').nullable();
        table.string('cancel_reason', 255).nullable();
      }

      table.datetime('deleted_at').nullable();
      table.uuid('deleted_by').nullable();
      table.string('delete_reason', 255).nullable();

      // 4. Child Table Columns (Standard Frappe Pattern)
      table.uuid('parent_id').nullable();
      table.string('parent_doctype', 100).nullable();
      table.string('parent_field', 100).nullable();
      table.integer('idx').defaultTo(0);

      // 5. Indexes
      table.index(['tenant_id'], `idx_${tableName}_tenant`);
      table.index(['tenant_id', 'status'], `idx_${tableName}_status`);
      table.index(['tenant_id', 'parent_id'], `idx_${tableName}_parent`);
    });
    logger.info(`Table ${tableName} created successfully.`);
  }

  async _alterTable(knex, tableName, meta) {
    logger.info(`Altering table (if needed): ${tableName}`);
    
    // Get existing columns
    const columns = await knex(tableName).columnInfo();
    const existingCols = Object.keys(columns).map(c => c.toLowerCase());
    
    const uiOnlyTypes = ['Section Break', 'Column Break', 'HTML'];

    await knex.schema.alterTable(tableName, (table) => {
      // Ensure child table columns exist
      if (!existingCols.includes('parent_id')) table.uuid('parent_id').nullable();
      if (!existingCols.includes('parent_doctype')) table.string('parent_doctype', 100).nullable();
      if (!existingCols.includes('parent_field')) table.string('parent_field', 100).nullable();
      if (!existingCols.includes('idx')) table.integer('idx').defaultTo(0);

      if (meta.has_lifecycle) {
        if (!existingCols.includes('workflow_state')) table.string('workflow_state', 100).nullable();
      }

      for (const field of meta.fields) {
        if (uiOnlyTypes.includes(field.fieldtype)) continue;

        const colName = field.fieldname.toLowerCase();
        if (!existingCols.includes(colName)) {
          logger.info(`Adding missing column '${colName}' to ${tableName}`);
          this._mapFieldType(table, field);
        }
      }
    });
  }
}

const instance = new SchemaEngine();
export default instance;
