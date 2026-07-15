import { randomUUID } from 'crypto';
import { logger } from '../../utils/logger.js';
import DatabaseEngine from '../DatabaseEngine/DatabaseEngine.js';
import EventEngine from '../EventEngine/EventEngine.js';
import CacheEngine from '../CacheEngine/CacheEngine.js';
import Container from '../Container.js';
import { NotFoundError, ValidationError, ForbiddenError } from '../../utils/errors.js';

class VersionEngine {
  constructor() {
    this.SENSITIVE_FIELDS = ['password', 'password_hash', 'pin', 'pin_hash', 'secret'];
    this.logQueue = [];
    this.isFlushing = false;
    this.flushInterval = null;
    this.MAX_VERSIONS = 50;
  }

  async init() {
    logger.info('Initializing Version Engine...');
    
    // Subscribe to Document Lifecycle Events
    EventEngine.on('*.after_insert', (p, c) => this._handleEvent('after_insert', p, c));
    EventEngine.on('*.after_update', (p, c) => this._handleEvent('after_update', p, c));
    EventEngine.on('*.submitted', (p, c) => this._handleEvent('submitted', p, c));
    
    // Start background flusher
    this.flushInterval = setInterval(() => this._flushQueue(), 2000);
    
    logger.info('Version Engine initialized successfully.');
  }

  // --- Core API ---
  
  async getVersions(doctype, docId, tenantId) {
    const knex = DatabaseEngine.getRawConnection();
    return await knex('sys_doc_version')
      .where({ tenant_id: tenantId, doctype, doc_id: docId })
      .select('version_number', 'is_current', 'is_protected', 'trigger_event', 'saved_by_name', 'saved_at', 'change_summary')
      .orderBy('version_number', 'desc');
  }

  async getVersion(doctype, docId, versionNumber, tenantId) {
    const knex = DatabaseEngine.getRawConnection();
    const version = await knex('sys_doc_version')
      .where({ tenant_id: tenantId, doctype, doc_id: docId, version_number: versionNumber })
      .first();
      
    if (!version) {
      throw new NotFoundError(`Version ${versionNumber} not found for document ${docId}`);
    }
    
    version.snapshot = JSON.parse(version.snapshot);
    return version;
  }

  async compareVersions(doctype, docId, v1, v2, tenantId) {
    const [versionA, versionB] = await Promise.all([
      this.getVersion(doctype, docId, v1, tenantId),
      this.getVersion(doctype, docId, v2, tenantId)
    ]);
    
    const snapA = versionA.snapshot;
    const snapB = versionB.snapshot;
    
    const diff = {};
    const allKeys = new Set([...Object.keys(snapA), ...Object.keys(snapB)]);
    
    for (const key of allKeys) {
      if (snapA[key] !== snapB[key]) {
        diff[key] = { v1: snapA[key], v2: snapB[key] };
      }
    }
    
    return {
      doctype,
      doc_id: docId,
      version_a: v1,
      version_b: v2,
      diff
    };
  }

  async restoreVersion(doctype, docId, versionNumber, tenantId, userId) {
    // Check if doc is locked or submitted (done in CRUD typically, but we should enforce here too ideally)
    const crudEngine = Container.resolve('CRUDEngine');
    const currentDoc = await crudEngine.get(doctype, docId, tenantId, userId);
    
    if (currentDoc.status === 'Locked' || currentDoc.status === 'Cancelled' || currentDoc.status === 'Deleted') {
      throw new ValidationError(`Cannot restore a document with status: ${currentDoc.status}`);
    }

    const versionToRestore = await this.getVersion(doctype, docId, versionNumber, tenantId);
    const snap = versionToRestore.snapshot;

    // Remove system fields from snapshot to avoid overwriting them
    const restoreData = { ...snap };
    delete restoreData.id;
    delete restoreData.tenant_id;
    delete restoreData.created_at;
    delete restoreData.created_by;
    delete restoreData.updated_at;
    delete restoreData.updated_by;
    delete restoreData.status;

    // Use CRUDEngine to update it so it triggers normal lifecycle hooks
    // Which will in turn trigger a new version snapshot creation
    await crudEngine.update(doctype, docId, restoreData, tenantId, userId);
    
    return {
      id: docId,
      restored_from_version: versionNumber,
      message: `Document restored to Version ${versionNumber}.`
    };
  }

  // --- Internal Handlers ---

  async _handleEvent(triggerEvent, payload, context) {
    const { doctype, doc, oldDoc } = payload;
    if (!doctype || !doc) return;

    // Note: We should ideally check if doctype track_changes is true.
    // For now we assume we track all that emit these events.

    let changeSummary = `Document ${triggerEvent.replace('after_', '')}`;
    if (triggerEvent === 'after_update' && oldDoc) {
      changeSummary = 'Document updated'; // Could compute changed fields here like AuditEngine does
    } else if (triggerEvent === 'submitted') {
      changeSummary = 'Document submitted';
    }

    // Prepare snapshot (stripping sensitive data)
    const snapshot = { ...doc };
    for (const field of this.SENSITIVE_FIELDS) {
      if (field in snapshot) delete snapshot[field];
    }

    const docId = doc.name || doc.id;

    // Retrieve and increment version number using Redis
    const cacheKey = `framee:version:${context.tenant_id}:${doctype}:${docId}`;
    let currentVersion = await CacheEngine.get(cacheKey) || 0;
    currentVersion += 1;
    await CacheEngine.set(cacheKey, currentVersion); // Persistent ideally, or use INCR directly if Redis client was exposed

    const versionData = {
      id: randomUUID(),
      tenant_id: context.tenant_id,
      doctype,
      doc_id: docId,
      version_number: currentVersion,
      snapshot: JSON.stringify(snapshot),
      change_summary: changeSummary,
      saved_by: context.user_id,
      saved_by_name: context.user_name || 'System',
      saved_at: new Date(),
      is_current: true,
      is_protected: triggerEvent === 'submitted',
      trigger_event: triggerEvent
    };

    this.logQueue.push(versionData);
  }

  async _flushQueue() {
    if (this.isFlushing || this.logQueue.length === 0) return;
    
    const knex = DatabaseEngine.getRawConnection();
    if (!knex) return;

    this.isFlushing = true;
    const batch = this.logQueue.splice(0, 50);

    try {
      for (const item of batch) {
        // Mark previous current as false
        await knex('sys_doc_version')
          .where({ tenant_id: item.tenant_id, doctype: item.doctype, doc_id: item.doc_id, is_current: true })
          .update({ is_current: false });

        // Insert new version
        await knex('sys_doc_version').insert(item);

        // Pruning logic could run here or in a separate scheduled job.
        // We'll skip inline pruning for now to keep it lightweight.
      }
    } catch (err) {
      logger.error('Failed to flush version logs to database:', err);
      // this.logQueue.unshift(...batch); // simplified error handling
    } finally {
      this.isFlushing = false;
    }
  }

  close() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    this._flushQueue();
    logger.info('Version Engine closed.');
  }
}

const instance = new VersionEngine();
export default instance;
