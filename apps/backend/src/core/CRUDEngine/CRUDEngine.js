import { v4 as uuidv4 } from 'uuid';
import Container from '../Container.js';
import { ValidationError, NotFoundError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

class CRUDEngine {
  constructor() {
    this.dbEngine = null;
    this.metaEngine = null;
    this.lifecycleEngine = null;
  }

  init() {
    logger.info('Initializing CRUD Engine...');
    this.dbEngine = Container.resolve('DatabaseEngine');
    this.metaEngine = Container.resolve('MetadataEngine');
    this.lifecycleEngine = Container.resolve('LifecycleEngine');
  }

  /**
   * Validates input data against the DocType schema.
   */
  _validate(data, meta, isUpdate = false) {
    const errors = [];
    
    // We only enforce required fields on insert, or if the field is present on update
    for (const field of meta.fields) {
      if (field.is_required) {
        if (!isUpdate && (data[field.fieldname] === undefined || data[field.fieldname] === null || data[field.fieldname] === '')) {
          errors.push(`Field '${field.fieldname}' is required.`);
        } else if (isUpdate && data[field.fieldname] !== undefined && (data[field.fieldname] === null || data[field.fieldname] === '')) {
          errors.push(`Field '${field.fieldname}' cannot be empty.`);
        }
      }
    }

    if (errors.length > 0) {
      throw new ValidationError('Validation failed', errors);
    }
  }

  /**
   * Insert a new record.
   */
  async insert(doctype, data, tenantId, userId) {
    await this.lifecycleEngine.canPerform('create', doctype, tenantId, userId);

    const meta = await this.metaEngine.getDocType(doctype, tenantId);
    this._validate(data, meta, false);

    const id = uuidv4();
    const tableName = meta.name.startsWith('sys_') ? meta.name : `dt_${meta.name.toLowerCase()}`;

    const record = {
      ...data,
      id,
      tenant_id: tenantId,
      created_by: userId,
      updated_by: userId,
      created_at: new Date(),
      updated_at: new Date(),
      status: meta.initial_status || 'Draft',
    };

    await this.dbEngine.getRawConnection()(tableName).insert(record);
    
    return this.get(doctype, id, tenantId, userId);
  }

  /**
   * Get a single record by ID.
   */
  async get(doctype, id, tenantId, userId) {
    await this.lifecycleEngine.canPerform('read', doctype, tenantId, userId);

    const meta = await this.metaEngine.getDocType(doctype, tenantId);
    const tableName = meta.name.startsWith('sys_') ? meta.name : `dt_${meta.name.toLowerCase()}`;

    const record = await this.dbEngine.query(tableName, tenantId)
      .where({ id })
      .first();

    if (!record || record.status === 'Deleted') {
      throw new NotFoundError(`${doctype} with ID ${id} not found.`);
    }

    return record;
  }

  /**
   * Get a list of records (paginated/filtered).
   */
  async getList(doctype, filters = {}, tenantId, userId) {
    await this.lifecycleEngine.canPerform('read', doctype, tenantId, userId);

    const meta = await this.metaEngine.getDocType(doctype, tenantId);
    const tableName = meta.name.startsWith('sys_') ? meta.name : `dt_${meta.name.toLowerCase()}`;

    const query = this.dbEngine.query(tableName, tenantId).whereNot('status', 'Deleted');
    
    // Apply basic equality filters
    for (const [key, value] of Object.entries(filters)) {
      if (['limit', 'offset', 'order_by'].includes(key)) continue;
      query.where(key, value);
    }

    if (filters.limit) query.limit(parseInt(filters.limit, 10));
    if (filters.offset) query.offset(parseInt(filters.offset, 10));
    
    const records = await query;
    return records;
  }

  /**
   * Update an existing record.
   */
  async update(doctype, id, data, tenantId, userId) {
    const meta = await this.metaEngine.getDocType(doctype, tenantId);
    const tableName = meta.name.startsWith('sys_') ? meta.name : `dt_${meta.name.toLowerCase()}`;

    const existingDoc = await this.dbEngine.query(tableName, tenantId).where({ id }).first();
    if (!existingDoc || existingDoc.status === 'Deleted') {
      throw new NotFoundError(`${doctype} with ID ${id} not found.`);
    }

    await this.lifecycleEngine.canPerform('update', doctype, tenantId, userId, existingDoc, data);

    this._validate(data, meta, true);

    const updateData = {
      ...data,
      updated_by: userId,
      updated_at: new Date()
    };
    // Ensure critical fields aren't updated
    delete updateData.id;
    delete updateData.tenant_id;
    delete updateData.created_by;
    delete updateData.created_at;
    delete updateData.status; // status is managed by lifecycle endpoints

    await this.dbEngine.query(tableName, tenantId)
      .where({ id })
      .update(updateData);

    return this.get(doctype, id, tenantId, userId);
  }

  /**
   * Soft delete a record.
   */
  async delete(doctype, id, tenantId, userId, reason = null) {
    const meta = await this.metaEngine.getDocType(doctype, tenantId);
    const tableName = meta.name.startsWith('sys_') ? meta.name : `dt_${meta.name.toLowerCase()}`;

    const existingDoc = await this.dbEngine.query(tableName, tenantId).where({ id }).first();
    if (!existingDoc || existingDoc.status === 'Deleted') {
      throw new NotFoundError(`${doctype} with ID ${id} not found.`);
    }

    if (meta.require_delete_reason && !reason) {
      throw new ValidationError(`Deletion of ${doctype} requires a reason.`);
    }

    await this.lifecycleEngine.canPerform('delete', doctype, tenantId, userId, existingDoc);

    // Soft delete
    await this.dbEngine.query(tableName, tenantId)
      .where({ id })
      .update({
        status: 'Deleted',
        deleted_at: new Date(),
        deleted_by: userId,
        delete_reason: reason,
        updated_at: new Date(),
        updated_by: userId
      });

    return { success: true, message: `${doctype} deleted successfully.` };
  }

  // --- LIFECYCLE ACTION METHODS ---

  async submit(doctype, id, tenantId, userId) {
    const meta = await this.metaEngine.getDocType(doctype, tenantId);
    const tableName = meta.name.startsWith('sys_') ? meta.name : `dt_${meta.name.toLowerCase()}`;

    const doc = await this.dbEngine.query(tableName, tenantId).where({ id }).first();
    if (!doc || doc.status === 'Deleted') throw new NotFoundError(`${doctype} with ID ${id} not found.`);

    await this.lifecycleEngine.canPerform('submit', doctype, tenantId, userId, doc);

    const nextStatus = meta.lock_on_submit ? 'Locked' : 'Submitted';

    await this.dbEngine.query(tableName, tenantId).where({ id }).update({
      status: nextStatus,
      submitted_at: new Date(),
      submitted_by: userId,
      updated_at: new Date(),
      updated_by: userId
    });

    return this.get(doctype, id, tenantId, userId);
  }

  async cancel(doctype, id, tenantId, userId, reason = null) {
    const meta = await this.metaEngine.getDocType(doctype, tenantId);
    const tableName = meta.name.startsWith('sys_') ? meta.name : `dt_${meta.name.toLowerCase()}`;

    const doc = await this.dbEngine.query(tableName, tenantId).where({ id }).first();
    if (!doc || doc.status === 'Deleted') throw new NotFoundError(`${doctype} with ID ${id} not found.`);

    await this.lifecycleEngine.canPerform('cancel', doctype, tenantId, userId, doc);

    await this.dbEngine.query(tableName, tenantId).where({ id }).update({
      status: 'Cancelled',
      cancelled_at: new Date(),
      cancelled_by: userId,
      cancel_reason: reason,
      updated_at: new Date(),
      updated_by: userId
    });

    return this.get(doctype, id, tenantId, userId);
  }
}

const instance = new CRUDEngine();
export default instance;
