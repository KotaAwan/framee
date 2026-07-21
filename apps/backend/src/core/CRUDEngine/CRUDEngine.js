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
      if (field.is_required && !field.is_hidden) {
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

  _parseDatabaseError(err, meta) {
    if (err.code === 'ER_DUP_ENTRY' || err.errno === 1062) {
      const match = err.message.match(/Duplicate entry '([^']+)' for key '([^']+)'/);
      if (match) {
        const val = match[1];
        const keyName = match[2];
        
        let fieldLabel = 'Field';
        for (const field of meta.fields) {
          const expectedKeyPart = `${meta.table_name}_${field.fieldname}_unique`;
          const expectedKeyPart2 = `${field.fieldname}_unique`;
          if (keyName.includes(expectedKeyPart) || keyName.includes(expectedKeyPart2) || keyName.toLowerCase().includes(field.fieldname.toLowerCase())) {
            fieldLabel = field.label || field.fieldname;
            break;
          }
        }
        
        return new ValidationError(`Duplicate entry detected`, [
          `${fieldLabel} '${val}' is already registered and must be unique.`
        ]);
      }
      return new ValidationError('Duplicate entry detected', [
        'A record with this unique value already exists.'
      ]);
    }
    return err;
  }

  /**
   * Insert a new record.
   */
  async insert(doctype, data, userId) {
    await this.lifecycleEngine.canPerform('create', doctype, userId);

    const meta = await this.metaEngine.getDocType(doctype);
    
    const tableName = meta.table_name;

    if (meta.is_single) {
      const existing = await this.dbEngine.query(tableName).first();
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

    let code = await this.namingEngine.generateCode(meta, parentData, tableName);

    const record = {
      ...parentData,
      code,
      status: meta.initial_status || 'New',
    };

    let insertedId;

    const trx = await this.dbEngine.getRawConnection().transaction();
    try {
      await this.workflowEngine.setInitialState(doctype, record);
      
      const [id] = await trx(tableName).insert(record);
      insertedId = id;
      record.id = insertedId; // For child records reference

      // Insert into _logs
      if (tableName !== 'sys_docfield') {
        await trx(`${tableName}_logs`).insert({
          doc_id: insertedId,
          status: 'Created',
          content: record.name || null,
          created_by: userId,
          created_at: new Date()
        });
      }

      for (const child of childrenData) {
        if (!child.options) throw new ValidationError(`Field ${child.fieldname} is missing 'options' (Child DocType).`);
        const childMeta = await this.metaEngine.getDocType(child.options);
        const childTableName = childMeta.table_name;
        
        let idx = 0;
        for (const row of child.records) {
          const childRecord = {
            ...row,
            parent_id: insertedId,
            parent_doctype: doctype,
            parent_field: child.fieldname,
            idx: idx++,
            status: childMeta.initial_status || 'Active',
          };
          
          if (childMeta.auto_code) {
             childRecord.code = await this.namingEngine.generateCode(childMeta, childRecord, childTableName);
          }

          const [childId] = await trx(childTableName).insert(childRecord);
          
          if (childTableName !== 'sys_docfield') {
            await trx(`${childTableName}_logs`).insert({
              doc_id: childId,
              status: 'Created',
              content: childRecord.name || null,
              created_by: userId,
              created_at: new Date()
            });
          }
        }
      }

      await trx.commit();
    } catch (err) {
      await trx.rollback();
      throw this._parseDatabaseError(err, meta);
    }

    const newRecord = await this.get(doctype, insertedId, userId);
    
    // Emit after_insert event
    await this.eventEngine.emit(`${doctype}.after_insert`, { doc: newRecord }, { 
      user_id: userId, 
      doc_id: insertedId, 
      doctype 
    });

    return newRecord;
  }

  /**
   * Get a single record by ID.
   */
  async get(doctype, id, userId) {
    await this.lifecycleEngine.canPerform('read', doctype, userId);

    const meta = await this.metaEngine.getDocType(doctype);
    const tableName = meta.table_name;

    let record;
    if (meta.is_single) {
      record = await this.dbEngine.query(tableName).first();
      // If it doesn't exist yet, return a template so frontend can render an empty form
      if (!record) {
        return { id: doctype, status: 'Saved' };
      }
    } else {
      record = await this.dbEngine.query(tableName)
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
        const childMeta = await this.metaEngine.getDocType(field.options);
        const childTableName = childMeta.table_name;
        
        const childRecords = await this.dbEngine.query(childTableName)
          .where({ parent_id: record.id, parent_field: field.fieldname, status: 'Saved' })
          .orderBy('idx', 'asc');
          
        record[field.fieldname] = childRecords;
      } catch (err) {
        logger.warn(`Failed to fetch child records for ${doctype}.${field.fieldname}: ${err.message}`);
        record[field.fieldname] = [];
      }
    }
    // Resolve sys_state for status field
    if (record.status) {
      try {
        const state = await this.dbEngine.query('sys_state')
          .where({ id: record.status })
          .orWhere({ name: record.status })
          .first();
        if (state) {
          record.status_id = record.status;
          record.status = state.name;
          record.status_style = state.style;
          record.is_terminal_state = state.is_terminal;
        }
      } catch (e) {
        logger.warn(`Failed to resolve sys_state for record: ${e.message}`);
      }
    }

    return record;
  }

  /**
   * Get a list of records (paginated/filtered).
   */
  async getList(doctype, filters = {}, userId) {
    await this.lifecycleEngine.canPerform('read', doctype, userId);

    const meta = await this.metaEngine.getDocType(doctype);
    const tableName = meta.table_name;

    const query = this.dbEngine.query(tableName).whereNot('status', 'Deleted').where(function() {
      this.where('is_deleted', false).orWhereNull('is_deleted');
    });
    
    const { page, pageSize, search, limit, offset, order_by, ...actualFilters } = filters;

    // Apply filters: use LIKE for Data/text fields, exact match for others (Link, Check, etc.)
    const TEXT_TYPES = new Set(['Data', 'Text', 'Small Text', 'Long Text', 'Password', 'Read Only']);
    for (const [key, value] of Object.entries(actualFilters)) {
      const fieldMeta = meta.fields.find(f => f.fieldname === key);
      const isTextField = !fieldMeta || TEXT_TYPES.has(fieldMeta.fieldtype);
      if (isTextField && value) {
        query.where(key, 'like', `%${value}%`);
      } else {
        query.where(key, value);
      }
    }

    if (search) {
      query.andWhere(function() {
        const filterFields = meta.fields.filter(f => f.in_filter);
        if (filterFields.length > 0) {
          filterFields.forEach((f, idx) => {
            if (idx === 0) {
              this.where(f.fieldname, 'like', `%${search}%`);
            } else {
              this.orWhere(f.fieldname, 'like', `%${search}%`);
            }
          });
        } else {
          const searchField = meta.title_field || 'name';
          this.where(searchField, 'like', `%${search}%`);
        }
      });
    }

    const _limit = limit ? parseInt(limit, 10) : (pageSize ? parseInt(pageSize, 10) : null);
    const _offset = offset ? parseInt(offset, 10) : (page && pageSize ? (parseInt(page, 10) - 1) * parseInt(pageSize, 10) : null);

    if (_limit) query.limit(_limit);
    if (_offset) query.offset(_offset);
    if (order_by) {
      const [col, dir] = order_by.split(' ');
      query.orderBy(col, dir || 'asc');
    } else {
      query.orderBy('id', 'desc');
    }
    
    const records = await query;
    
    // Resolve Link Fields to their display names
    if (records.length > 0) {
      const linkFields = meta.fields.filter(f => f.fieldtype === 'Link' && f.options);
      for (const field of linkFields) {
        const ids = [...new Set(records.map(r => r[field.fieldname]).filter(Boolean))];
        if (ids.length === 0) continue;
        
        try {
          const docTypeName = Array.isArray(field.options) ? field.options[0] : field.options;
          const linkedMeta = await this.metaEngine.getDocType(docTypeName);
          const linkedTableName = linkedMeta.table_name;
          const titleField = linkedMeta.title_field || 'name';
          
          const linkedRecords = await this.dbEngine.query(linkedTableName)
            .whereIn('id', ids)
            .select('*');
            
          const idToTitleMap = {};
          for (const lr of linkedRecords) {
            const title = lr[titleField] || lr.name || lr.id;
            idToTitleMap[lr.id] = title;
          }
          
          for (const record of records) {
            if (record[field.fieldname] && idToTitleMap[record[field.fieldname]]) {
              record[field.fieldname] = idToTitleMap[record[field.fieldname]];
            }
          }
        } catch (e) {
          logger.warn(`Failed to resolve link field ${field.fieldname}: ${e.message}`);
        }
      }
    }

    // Resolve sys_state for status field
    if (records.length > 0) {
      const stateIds = [...new Set(records.map(r => r.status).filter(Boolean))];
      if (stateIds.length > 0) {
        try {
          const states = await this.dbEngine.query('sys_state')
            .whereIn('id', stateIds)
            .orWhereIn('name', stateIds)
            .select('id', 'name', 'style', 'is_terminal');
            
          const stateMap = {};
          for (const s of states) {
            stateMap[s.id] = s;
            stateMap[s.name] = s;
          }
          
          for (const record of records) {
            if (record.status && stateMap[record.status]) {
              const st = stateMap[record.status];
              record.status_id = record.status;
              record.status = st.name;
              record.status_style = st.style;
              record.is_terminal_state = st.is_terminal;
            }
          }
        } catch (e) {
          logger.warn(`Failed to resolve sys_state for list: ${e.message}`);
        }
      }
    }
    
    // Inject social counts and is_liked
    if (records.length > 0) {
      const docIds = records.map(r => r.id);
      
      let auditLogs = [];
      if (tableName !== 'sys_docfield') {
        auditLogs = await this.dbEngine.getRawConnection()(`${tableName}_logs`)
          .whereIn('doc_id', docIds)
          .whereIn('status', ['Liked', 'Unliked', 'Commented']);
      }
        
      for (const record of records) {
        const logs = auditLogs.filter(l => l.doc_id === record.id);
        const likes = logs.filter(l => l.status === 'Liked').length;
        const unlikes = logs.filter(l => l.status === 'Unliked').length;
        record.likes = Math.max(0, likes - unlikes);
        record.comments = logs.filter(l => l.status === 'Commented').length;
        
        const myLogs = logs.filter(l => l.created_by === userId && (l.status === 'Liked' || l.status === 'Unliked'))
                           .sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
        record.is_liked = myLogs.length > 0 && myLogs[0].status === 'Liked';
      }
    }
    
    return records;
  }

  /**
   * Update an existing record.
   */
  async update(doctype, id, data, userId) {
    const meta = await this.metaEngine.getDocType(doctype);
    const tableName = meta.table_name;

    let existingDoc;
    if (meta.is_single) {
      existingDoc = await this.dbEngine.query(tableName).first();
      if (!existingDoc) {
        return this.insert(doctype, data, userId);
      }
    } else {
      existingDoc = await this.dbEngine.query(tableName).where({ id }).first();
    }

    if (!existingDoc || existingDoc.status === 'Deleted') {
      throw new NotFoundError(`${doctype} with ID ${id} not found.`);
    }

    await this.lifecycleEngine.canPerform('update', doctype, userId, existingDoc, data);

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
      ...parentData
    };
    // Ensure critical fields aren't updated
    delete updateData.id;
    delete updateData.code;
    delete updateData.status;

    const trx = await this.dbEngine.getRawConnection().transaction();
    try {
      // 1. Copy old data to _version table
      if (tableName !== 'sys_docfield') {
        const oldData = { ...existingDoc, doc_id: existingDoc.id, backup_by: userId, backup_at: new Date() };
        delete oldData.id;
        await trx(`${tableName}_version`).insert(oldData);
      }

      // 2. Update main table
      await trx(tableName)
        .where({ id: existingDoc.id })
        .update(updateData);
        
      // 3. Insert into _logs
      if (tableName !== 'sys_docfield') {
        await trx(`${tableName}_logs`).insert({
          doc_id: existingDoc.id,
          status: 'Updated',
          content: updateData.name || existingDoc.name || null,
          created_by: userId,
          created_at: new Date()
        });
      }

      // 4. Update children
      for (const child of childrenData) {
        if (!child.options) continue;
        const childMeta = await this.metaEngine.getDocType(child.options);
        const childTableName = childMeta.table_name;
        
        await trx(childTableName).where({ parent_id: existingDoc.id, parent_field: child.fieldname }).del();
        
        let idx = 0;
        for (const row of child.records) {
          const childRecord = {
            ...row,
            parent_id: existingDoc.id,
            parent_doctype: doctype,
            parent_field: child.fieldname,
            idx: idx++,
            status: childMeta.initial_status || 'Active',
          };
          delete childRecord.id;
          
          if (childMeta.auto_code && !childRecord.code) {
             childRecord.code = await this.namingEngine.generateCode(childMeta, childRecord, childTableName);
          }
          
          const [childId] = await trx(childTableName).insert(childRecord);
          
          if (childTableName !== 'sys_docfield') {
            await trx(`${childTableName}_logs`).insert({
              doc_id: childId,
              status: 'Created',
              content: childRecord.name || null,
              created_by: userId,
              created_at: new Date()
            });
          }
        }
      }

      await trx.commit();
    } catch (err) {
      await trx.rollback();
      throw this._parseDatabaseError(err, meta);
    }

    const updatedRecord = await this.get(doctype, existingDoc.id, userId);

    // Emit after_update event
    await this.eventEngine.emit(`${doctype}.after_update`, { doc: updatedRecord, oldDoc: existingDoc, newDoc: updatedRecord }, { 
      user_id: userId, 
      doc_id: existingDoc.id, 
      doctype 
    });

    return updatedRecord;
  }

  /**
   * Soft delete a record.
   */
  async delete(doctype, id, userId, reason = null) {
    const meta = await this.metaEngine.getDocType(doctype);
    const tableName = meta.table_name;

    const existingDoc = await this.dbEngine.query(tableName).where({ id }).first();
    if (!existingDoc || existingDoc.status === 'Deleted') {
      throw new NotFoundError(`${doctype} with ID ${id} not found.`);
    }

    if (meta.require_delete_reason && !reason) {
      throw new ValidationError(`Deletion of ${doctype} requires a reason.`);
    }

    await this.lifecycleEngine.canPerform('delete', doctype, userId, existingDoc);

    // Soft delete
    await this.dbEngine.query(tableName)
      .where({ id })
      .update({
        is_deleted: true
      });
      
    // Insert into _logs
    if (tableName !== 'sys_docfield') {
      await this.dbEngine.getRawConnection()(`${tableName}_logs`).insert({
        doc_id: id,
        status: 'Deleted',
        content: existingDoc.name || null,
        created_by: userId,
        created_at: new Date()
      });
    }

    // Emit after_delete event
    await this.eventEngine.emit(`${doctype}.after_delete`, { id, status: 'Deleted', delete_reason: reason }, { 
      user_id: userId, 
      doc_id: id, 
      doctype 
    });

    return { success: true, message: `${doctype} deleted successfully.` };
  }

  // --- LIFECYCLE ACTION METHODS ---

  async submit(doctype, id, userId) {
    const meta = await this.metaEngine.getDocType(doctype);
    const tableName = meta.table_name;

    const doc = await this.dbEngine.query(tableName).where({ id }).first();
    if (!doc || doc.status === 'Deleted') throw new NotFoundError(`${doctype} with ID ${id} not found.`);

    await this.lifecycleEngine.canPerform('submit', doctype, userId, doc);

    const nextStatus = meta.lock_on_submit ? 'Locked' : 'Submitted';

    await this.dbEngine.query(tableName).where({ id }).update({
      status: nextStatus,
      submitted_at: new Date(),
      submitted_by: userId,
      updated_at: new Date(),
      updated_by: userId
    });

    return this.get(doctype, id, userId);
  }

  async cancel(doctype, id, userId, reason = null) {
    const meta = await this.metaEngine.getDocType(doctype);
    const tableName = meta.table_name;

    const doc = await this.dbEngine.query(tableName).where({ id }).first();
    if (!doc || doc.status === 'Deleted') throw new NotFoundError(`${doctype} with ID ${id} not found.`);

    await this.lifecycleEngine.canPerform('cancel', doctype, userId, doc);

    await this.dbEngine.query(tableName).where({ id }).update({
      status: 'Cancelled'
    });

    return this.get(doctype, id, userId);
  }

  async toggleLock(doctype, id, newStatus, userId) {
    const meta = await this.metaEngine.getDocType(doctype);
    const tableName = meta.table_name;

    const doc = await this.dbEngine.query(tableName).where({ id }).first();
    if (!doc || doc.status === 'Deleted') throw new NotFoundError(`${doctype} with ID ${id} not found.`);

    await this.dbEngine.query(tableName).where({ id }).update({
      status: newStatus
    });

    if (tableName !== 'sys_docfield') {
      try {
        await this.dbEngine.getRawConnection()(`${tableName}_logs`).insert({
          doc_id: id,
          status: newStatus,
          content: doc.name || null,
          created_by: userId,
          created_at: new Date()
        });
      } catch (err) {
        // Table might not exist or log failed, safely ignore
      }
    }

    const updatedDoc = { ...doc, status: newStatus };

    await this.eventEngine.emit(`${doctype}.${newStatus === 'Locked' ? 'locked' : 'unlocked'}`, { doc: updatedDoc }, { 
      user_id: userId, 
      doc_id: id, 
      doctype 
    });

    return this.get(doctype, id, userId);
  }
}

const instance = new CRUDEngine();
export default instance;
