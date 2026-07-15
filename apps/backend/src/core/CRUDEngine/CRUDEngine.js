import { v4 as uuidv4 } from 'uuid';
import Container from '../Container.js';
import { ValidationError, NotFoundError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

class CRUDEngine {
  constructor() {
    this.dbEngine = null;
    this.metaEngine = null;
    this.lifecycleEngine = null;
    this.eventEngine = null;
  }

  init() {
    logger.info('Initializing CRUD Engine...');
    this.dbEngine = Container.resolve('DatabaseEngine');
    this.metaEngine = Container.resolve('MetadataEngine');
    this.lifecycleEngine = Container.resolve('LifecycleEngine');
    this.eventEngine = Container.resolve('EventEngine');
    this.workflowEngine = Container.resolve('WorkflowEngine');
    this.namingEngine = Container.resolve('NamingEngine');
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
    
    const tableName = meta.name.startsWith('sys_') ? meta.name : `dt_${meta.name.toLowerCase()}`;

    if (meta.is_single) {
      // Ensure only 1 record exists
      const existing = await this.dbEngine.query(tableName, tenantId).first();
      if (existing) {
        throw new ValidationError(`A record for single doctype ${doctype} already exists.`);
      }
    }

    const parentData = { ...data };
    const childrenData = [];

    for (const field of meta.fields) {
      if (field.fieldtype === 'Table') {
        if (parentData[field.fieldname] !== undefined) {
          childrenData.push({
            fieldname: field.fieldname,
            options: field.options,
            records: parentData[field.fieldname]
          });
          delete parentData[field.fieldname];
        }
      }
    }

    this._validate(parentData, meta, false);

    const id = await this.namingEngine.generateId(meta, parentData, tenantId);

    const record = {
      ...parentData,
      id,
      tenant_id: tenantId,
      created_by: userId,
      updated_by: userId,
      created_at: new Date(),
      updated_at: new Date(),
      status: meta.initial_status || 'Draft',
    };

    const trx = await this.dbEngine.getRawConnection().transaction();
    try {
      await this.workflowEngine.setInitialState(doctype, record, tenantId);
      
      await trx(tableName).insert(record);

      for (const child of childrenData) {
        if (!child.options) throw new ValidationError(`Field ${child.fieldname} is missing 'options' (Child DocType).`);
        const childMeta = await this.metaEngine.getDocType(child.options, tenantId);
        const childTableName = childMeta.name.startsWith('sys_') ? childMeta.name : `dt_${childMeta.name.toLowerCase()}`;
        
        let idx = 0;
        for (const row of child.records) {
          const childId = uuidv4();
          const childRecord = {
            ...row,
            id: childId,
            tenant_id: tenantId,
            parent_id: id,
            parent_doctype: doctype,
            parent_field: child.fieldname,
            idx: idx++,
            created_by: userId,
            updated_by: userId,
            created_at: new Date(),
            updated_at: new Date(),
            status: childMeta.initial_status || 'Active',
          };
          await trx(childTableName).insert(childRecord);
        }
      }

      await trx.commit();
    } catch (err) {
      await trx.rollback();
      throw err;
    }
    
    const newRecord = await this.get(doctype, id, tenantId, userId);
    
    // Emit after_insert event
    await this.eventEngine.emit(`${doctype}.after_insert`, { doc: newRecord }, { 
      tenant_id: tenantId, 
      user_id: userId, 
      doc_id: id, 
      doctype 
    });

    return newRecord;
  }

  /**
   * Get a single record by ID.
   */
  async get(doctype, id, tenantId, userId) {
    await this.lifecycleEngine.canPerform('read', doctype, tenantId, userId);

    const meta = await this.metaEngine.getDocType(doctype, tenantId);
    const tableName = meta.name.startsWith('sys_') ? meta.name : `dt_${meta.name.toLowerCase()}`;

    let record;
    if (meta.is_single) {
      record = await this.dbEngine.query(tableName, tenantId).first();
      // If it doesn't exist yet, return a template so frontend can render an empty form
      if (!record) {
        return { id: doctype, status: 'Active' };
      }
    } else {
      record = await this.dbEngine.query(tableName, tenantId)
        .where({ id })
        .first();
    }

    if (!record || record.status === 'Deleted') {
      throw new NotFoundError(`${doctype} with ID ${id} not found.`);
    }

    // Fetch children
    const childrenFields = meta.fields.filter(f => f.fieldtype === 'Table');
    for (const field of childrenFields) {
      if (!field.options) continue;
      try {
        const childMeta = await this.metaEngine.getDocType(field.options, tenantId);
        const childTableName = childMeta.name.startsWith('sys_') ? childMeta.name : `dt_${childMeta.name.toLowerCase()}`;
        
        const childRecords = await this.dbEngine.query(childTableName, tenantId)
          .where({ parent_id: record.id, parent_field: field.fieldname, status: 'Active' })
          .orderBy('idx', 'asc');
          
        record[field.fieldname] = childRecords;
      } catch (err) {
        logger.warn(`Failed to fetch child records for ${doctype}.${field.fieldname}: ${err.message}`);
        record[field.fieldname] = [];
      }
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
    
    const { page, pageSize, search, limit, offset, order_by, ...actualFilters } = filters;

    // Apply basic equality filters
    for (const [key, value] of Object.entries(actualFilters)) {
      query.where(key, value);
    }

    if (search) {
      const searchField = meta.title_field || 'name';
      query.andWhere(searchField, 'like', `%${search}%`);
    }

    const _limit = limit ? parseInt(limit, 10) : (pageSize ? parseInt(pageSize, 10) : null);
    const _offset = offset ? parseInt(offset, 10) : (page && pageSize ? (parseInt(page, 10) - 1) * parseInt(pageSize, 10) : null);

    if (_limit) query.limit(_limit);
    if (_offset) query.offset(_offset);
    
    const records = await query;
    
    // Resolve Link Fields to their display names
    if (records.length > 0) {
      const linkFields = meta.fields.filter(f => f.fieldtype === 'Link' && f.options);
      for (const field of linkFields) {
        const ids = [...new Set(records.map(r => r[field.fieldname]).filter(Boolean))];
        if (ids.length === 0) continue;
        
        try {
          const linkedMeta = await this.metaEngine.getDocType(field.options, tenantId);
          const linkedTableName = linkedMeta.name.startsWith('sys_') ? linkedMeta.name : `dt_${linkedMeta.name.toLowerCase()}`;
          const titleField = linkedMeta.title_field || 'name';
          
          const linkedRecords = await this.dbEngine.query(linkedTableName, tenantId)
            .whereIn('id', ids)
            .select('id', titleField);
            
          const idToTitleMap = {};
          for (const lr of linkedRecords) {
            idToTitleMap[lr.id] = lr[titleField] || lr.id;
          }
          
          for (const record of records) {
            if (record[field.fieldname] && idToTitleMap[record[field.fieldname]]) {
              record[field.fieldname] = idToTitleMap[record[field.fieldname]];
            }
          }
        } catch (err) {
          console.warn(`Failed to resolve link field ${field.fieldname} for ${doctype}:`, err.message);
        }
      }
    }
    
    // Inject social counts and is_liked
    if (records.length > 0) {
      const docIds = records.map(r => r.id);
      const auditLogs = await this.dbEngine.query('sys_audit_log', tenantId, { includeDeleted: true })
        .where('doctype', doctype)
        .whereIn('doc_id', docIds)
        .whereIn('action', ['LIKE', 'UNLIKE', 'COMMENT']);
        
      for (const record of records) {
        const logs = auditLogs.filter(l => l.doc_id === record.id);
        const likes = logs.filter(l => l.action === 'LIKE').length;
        const unlikes = logs.filter(l => l.action === 'UNLIKE').length;
        record.likes = Math.max(0, likes - unlikes);
        record.comments = logs.filter(l => l.action === 'COMMENT').length;
        
        // Find last like/unlike by current user
        const myLogs = logs.filter(l => l.user_id === userId && (l.action === 'LIKE' || l.action === 'UNLIKE'))
                           .sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
        record.is_liked = myLogs.length > 0 && myLogs[0].action === 'LIKE';
      }
    }
    
    return records;
  }

  /**
   * Update an existing record.
   */
  async update(doctype, id, data, tenantId, userId) {
    const meta = await this.metaEngine.getDocType(doctype, tenantId);
    const tableName = meta.name.startsWith('sys_') ? meta.name : `dt_${meta.name.toLowerCase()}`;

    let existingDoc;
    if (meta.is_single) {
      existingDoc = await this.dbEngine.query(tableName, tenantId).first();
      if (!existingDoc) {
        // If it's a single doctype and doesn't exist, we insert it instead
        return this.insert(doctype, data, tenantId, userId);
      }
    } else {
      existingDoc = await this.dbEngine.query(tableName, tenantId).where({ id }).first();
    }

    if (!existingDoc || existingDoc.status === 'Deleted') {
      throw new NotFoundError(`${doctype} with ID ${id} not found.`);
    }

    await this.lifecycleEngine.canPerform('update', doctype, tenantId, userId, existingDoc, data);

    const parentData = { ...data };
    const childrenData = [];

    for (const field of meta.fields) {
      if (field.fieldtype === 'Table') {
        if (parentData[field.fieldname] !== undefined) {
          childrenData.push({
            fieldname: field.fieldname,
            options: field.options,
            records: parentData[field.fieldname]
          });
          delete parentData[field.fieldname];
        }
      }
    }

    this._validate(parentData, meta, true);

    const updateData = {
      ...parentData,
      updated_by: userId,
      updated_at: new Date()
    };
    // Ensure critical fields aren't updated
    delete updateData.id;
    delete updateData.tenant_id;
    delete updateData.created_by;
    delete updateData.created_at;
    delete updateData.status;

    const trx = await this.dbEngine.getRawConnection().transaction();
    try {
      await trx(tableName)
        .where({ id: existingDoc.id, tenant_id: tenantId })
        .update(updateData);

      for (const child of childrenData) {
        if (!child.options) continue;
        const childMeta = await this.metaEngine.getDocType(child.options, tenantId);
        const childTableName = childMeta.name.startsWith('sys_') ? childMeta.name : `dt_${childMeta.name.toLowerCase()}`;
        
        // Hard delete existing children (easiest way to sync)
        await trx(childTableName).where({ parent_id: existingDoc.id, parent_field: child.fieldname }).del();
        
        let idx = 0;
        for (const row of child.records) {
          const childId = uuidv4();
          const childRecord = {
            ...row,
            id: childId,
            tenant_id: tenantId,
            parent_id: existingDoc.id,
            parent_doctype: doctype,
            parent_field: child.fieldname,
            idx: idx++,
            created_by: existingDoc.created_by || userId,
            updated_by: userId,
            created_at: existingDoc.created_at || new Date(),
            updated_at: new Date(),
            status: childMeta.initial_status || 'Active',
          };
          await trx(childTableName).insert(childRecord);
        }
      }

      await trx.commit();
    } catch (err) {
      await trx.rollback();
      throw err;
    }

    const updatedRecord = await this.get(doctype, existingDoc.id, tenantId, userId);

    // Emit after_update event
    await this.eventEngine.emit(`${doctype}.after_update`, { doc: updatedRecord, oldDoc: existingDoc, newDoc: updatedRecord }, { 
      tenant_id: tenantId, 
      user_id: userId, 
      doc_id: existingDoc.id, 
      doctype 
    });

    return updatedRecord;
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

    // Emit after_delete event
    await this.eventEngine.emit(`${doctype}.after_delete`, { id, status: 'Deleted', delete_reason: reason }, { 
      tenant_id: tenantId, 
      user_id: userId, 
      doc_id: id, 
      doctype 
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

  async toggleLock(doctype, id, newStatus, tenantId, userId) {
    const meta = await this.metaEngine.getDocType(doctype, tenantId);
    const tableName = meta.name.startsWith('sys_') ? meta.name : `dt_${meta.name.toLowerCase()}`;

    const doc = await this.dbEngine.query(tableName, tenantId).where({ id }).first();
    if (!doc || doc.status === 'Deleted') throw new NotFoundError(`${doctype} with ID ${id} not found.`);

    // Require admin or specific permission? (skip for now, handled by route or logic)
    
    await this.dbEngine.query(tableName, tenantId).where({ id }).update({
      status: newStatus,
      updated_at: new Date(),
      updated_by: userId
    });

    await this.eventEngine.emit(`${doctype}.${newStatus === 'Locked' ? 'locked' : 'unlocked'}`, { doc_id: id }, { 
      tenant_id: tenantId, 
      user_id: userId, 
      doc_id: id, 
      doctype 
    });

    return this.get(doctype, id, tenantId, userId);
  }
}

const instance = new CRUDEngine();
export default instance;
