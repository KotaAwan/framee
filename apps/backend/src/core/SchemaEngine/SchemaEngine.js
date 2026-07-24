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
    const doc = payload?.doc || payload;
    const doctypeName = doc?.name || doc?.table_name || doc?.slug;
    if (!doctypeName) return;
    try {
      await this.syncTable(doctypeName);

      // Seed standard workflow for Standard DocTypes
      const docTypeKind = doc?.type || 'Standard';
      if (docTypeKind === 'Standard') {
        await this._seedStandardWorkflow(doc);
      }
    } catch (err) {
      logger.error(`Error in SchemaEngine on DocType change for ${doctypeName}:`, err);
    }
  }

  async _seedStandardWorkflow(doc) {
    try {
      const knex = this.dbEngine.getRawConnection();
      const doctypeTarget = doc.table_name || doc.slug || doc.name;
      if (!doctypeTarget) return;
      
      // Check if workflow transitions already exist for this doctype
      const existing = await knex('sys_workflow').where({ doctype: doctypeTarget }).first();
      if (existing) return;

      const namingEngine = Container.resolve('NamingEngine');
      const sysWfMeta = await this.metaEngine.getDocType('sys_workflow').catch(() => null);

      const defaultTransitions = [
        { from_state: 'New', action: 'Save', to_state: 'Saved', log_status: 'Created' },
        { from_state: 'Saved', action: 'Unlock', to_state: 'Draft', log_status: 'Unlocked' },
        { from_state: 'Draft', action: 'Lock', to_state: 'Saved', log_status: 'Locked' },
        { from_state: 'Draft', action: 'Update', to_state: 'Saved', log_status: 'Updated' },
        { from_state: 'Draft', action: 'Delete', to_state: 'Deleted', log_status: 'Deleted' },
      ];

      for (const tr of defaultTransitions) {
        const record = {
          name: `${doc.name || doctypeTarget}: ${tr.from_state} → ${tr.to_state}`,
          doctype: doctypeTarget,
          from_state: tr.from_state,
          to_state: tr.to_state,
          action: tr.action,
          log_status: tr.log_status,
          allow_roles: JSON.stringify([1]),
          is_deleted: false,
          status: 'Saved'
        };
        
        if (sysWfMeta && sysWfMeta.auto_code) {
          record.code = await namingEngine.generateCode(sysWfMeta, record, 'sys_workflow');
        }

        await knex('sys_workflow').insert(record);
      }
      logger.info(`Seeded standard workflow transitions for DocType ${doctypeTarget}`);
    } catch (err) {
      logger.warn(`Failed to seed standard workflow for ${doc.name}: ${err.message}`);
    }
  }

  async _handleDocFieldChange(payload, context) {
    const doc = payload?.doc || payload;
    const doctypeRef = doc?.doctype;
    if (!doctypeRef) return;
    try {
      const doctype = await this.dbEngine.query('sys_doctype', { includeDeleted: true })
        .where(function() {
          this.where('table_name', doctypeRef).orWhere('slug', doctypeRef).orWhere('name', doctypeRef);
        })
        .whereNot('status', 'Deleted')
        .first();
      
      if (doctype) {
        // Invalidate meta cache before syncing
        const CACHE_PREFIX = 'framee:meta';
        const cacheEngine = Container.resolve('CacheEngine');
        await cacheEngine.del(`${CACHE_PREFIX}:${doctype.name}`);
        if (doctype.table_name) await cacheEngine.del(`${CACHE_PREFIX}:${doctype.table_name}`);
        if (doctype.slug) await cacheEngine.del(`${CACHE_PREFIX}:${doctype.slug}`);
        
        await this.syncTable(doctype.name);
      }
    } catch (err) {
      logger.error(`Error in SchemaEngine on DocField change for doctype ${doctypeRef}:`, err);
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
      case 'Tab Break':
      case 'Column Break':
      case 'Table':
      case 'HTML':
        break;
      default:
        logger.warn(`Unknown fieldtype '${fieldtype}' for field '${fieldname}'. Falling back to VARCHAR(255)`);
        table.string(fieldname, 255);
    }
  }

  /**
   * Synchronizes the physical table schema for a given DocType.
   */
  async syncTable(doctypeName) {
    logger.info(`Syncing table schema for DocType: ${doctypeName}`);
    
    try {
      const meta = await this.metaEngine.getDocType(doctypeName);
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
      // 1. Standard Columns (id, code)
      table.increments('id').unsigned().primary();
      table.string('code', 100).nullable();
      
      // 2. Dynamic DocFields (Excludes Section Break, Tab Break, Column Break, Table)
      for (const field of meta.fields || []) {
        this._mapFieldType(table, field);
      }
      
      // 3. Status & Deletion Flags
      table.boolean('is_deleted').defaultTo(false);
      table.string('status', 50).defaultTo('Active');

      // 4. Index on Status
      table.index(['status'], `idx_${tableName}_status`);
    });
    logger.info(`Table ${tableName} created successfully.`);

    // 5. Create _logs Table
    const logsTableName = `${tableName}_logs`;
    const logsExists = await knex.schema.hasTable(logsTableName);
    if (!logsExists) {
      await knex.schema.createTable(logsTableName, (t) => {
        t.increments('id').unsigned().primary();
        t.integer('doc_id').unsigned().notNullable();
        t.string('status', 30).nullable();
        t.string('content', 100).nullable();
        t.integer('created_by').unsigned().nullable();
        t.timestamp('created_at').defaultTo(knex.fn.now());
      });
      logger.info(`Table ${logsTableName} created successfully.`);
    }

    // 6. Create _version Table
    const versionTableName = `${tableName}_version`;
    const versionExists = await knex.schema.hasTable(versionTableName);
    if (!versionExists) {
      try {
        await knex.raw(`CREATE TABLE ?? SELECT * FROM ?? WHERE 1=0`, [versionTableName, tableName]);
        // Add backup_by, backup_at, doc_id if missing
        const vCols = await knex(versionTableName).columnInfo();
        await knex.schema.alterTable(versionTableName, (t) => {
          if (!vCols.doc_id) t.integer('doc_id').unsigned().nullable();
          if (!vCols.backup_by) t.integer('backup_by').unsigned().nullable();
          if (!vCols.backup_at) t.datetime('backup_at').nullable();
        });
        logger.info(`Table ${versionTableName} created successfully.`);
      } catch (e) {
        logger.warn(`Failed to create version table ${versionTableName}: ${e.message}`);
      }
    }
  }

  async _alterTable(knex, tableName, meta) {
    logger.info(`Altering table (if needed): ${tableName}`);
    
    const columns = await knex(tableName).columnInfo();
    const existingCols = Object.keys(columns).map(c => c.toLowerCase());
    
    const uiOnlyTypes = ['Section Break', 'Tab Break', 'Column Break', 'Table', 'HTML'];

    await knex.schema.alterTable(tableName, (table) => {
      if (!existingCols.includes('code')) table.string('code', 100).nullable();
      if (!existingCols.includes('is_deleted')) table.boolean('is_deleted').defaultTo(false);
      if (!existingCols.includes('status')) table.string('status', 50).defaultTo('Active');

      for (const field of meta.fields || []) {
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
