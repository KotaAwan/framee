import { randomUUID } from 'crypto';
import { logger } from '../../utils/logger.js';
import DatabaseEngine from '../DatabaseEngine/DatabaseEngine.js';
import EventEngine from '../EventEngine/EventEngine.js';
import { config } from '../../config/env.js';

class AuditEngine {
  constructor() {
    this.logQueue = [];
    this.isFlushing = false;
    this.flushInterval = null;
    this.SENSITIVE_FIELDS = ['password', 'password_hash', 'pin', 'pin_hash', 'secret'];
  }

  /**
   * Initializes the Audit Engine.
   */
  async init() {
    logger.info('Initializing Audit Engine...');
    
    // Subscribe to System Events (Global Log only)
    EventEngine.on('user.login', (p, c) => this._handleSystemEvent('LOGIN', p, c));
    EventEngine.on('user.logout', (p, c) => this._handleSystemEvent('LOGOUT', p, c));
    EventEngine.on('user.login_failed', (p, c) => this._handleSystemEvent('LOGIN_FAILED', p, c));
    EventEngine.on('user.role_assigned', (p, c) => this._handleSystemEvent('ROLE_ASSIGNED', p, c));
    EventEngine.on('user.role_removed', (p, c) => this._handleSystemEvent('ROLE_REMOVED', p, c));

    // Subscribe to Document Lifecycle Events (Both Logs)
    EventEngine.on('*.after_insert', (p, c) => this._handleDocumentEvent('Created', p, c));
    EventEngine.on('*.after_update', (p, c) => this._handleDocumentEvent('Updated', p, c));
    EventEngine.on('*.deleted', (p, c) => this._handleDocumentEvent('Deleted', p, c));
    EventEngine.on('*.submitted', (p, c) => this._handleDocumentEvent('Submitted', p, c));
    EventEngine.on('*.cancelled', (p, c) => this._handleDocumentEvent('Cancelled', p, c));
    EventEngine.on('*.locked', (p, c) => this._handleDocumentEvent('Locked', p, c));
    EventEngine.on('*.unlocked', (p, c) => this._handleDocumentEvent('Unlocked', p, c));

    // Subscribe to Social Events (Local Log only)
    EventEngine.on('*.comment', (p, c) => this._handleSocialEvent('COMMENT', p, c));
    EventEngine.on('*.liked', (p, c) => this._handleSocialEvent('LIKE', p, c));
    EventEngine.on('*.unliked', (p, c) => this._handleSocialEvent('UNLIKE', p, c));

    // Start background flusher
    this.flushInterval = setInterval(() => this._flushLogs(), 1000);
    
    logger.info('Audit Engine initialized successfully.');
  }

  // --- Event Handlers ---

  _handleSystemEvent(action, payload, context) {
    const entry = this._createGlobalLogEntry({
      action,
      tenant_id: context.tenant_id,
      user_id: payload.userId || context.user_id,
      user_name: context.user_name || 'System',
      ip_address: context.ip_address,
      user_agent: context.user_agent,
      change_summary: `User ${action.toLowerCase().replace('_', ' ')}`,
      metadata: payload
    });
    this.logQueue.push({ type: 'global', data: entry });
  }

  _handleDocumentEvent(action, payload, context) {
    const doctype = payload.doctype || context.doctype;
    const doc = payload.doc || payload;
    if (!doctype || !doc) return;

    let diff = null;
    let changeSummary = `${action} ${doctype}`;

    if (action === 'Updated' && payload.oldDoc && payload.newDoc) {
      diff = this._computeDiff(payload.oldDoc, payload.newDoc);
      if (Object.keys(diff).length === 0) return; // No meaningful changes
      const changedFields = Object.keys(diff).join(', ');
      changeSummary = `Updated fields: ${changedFields}`;
    }

    const docId = doc.name || doc.id;
    const docNameTitle = doc.title || docId;

    // Queue Global Log
    const globalEntry = this._createGlobalLogEntry({
      action,
      tenant_id: context.tenant_id,
      doctype,
      doc_id: docId,
      doc_name: docNameTitle,
      user_id: context.user_id,
      user_name: context.user_name || 'System',
      ip_address: context.ip_address,
      user_agent: context.user_agent,
      diff,
      change_summary: changeSummary
    });
    this.logQueue.push({ type: 'global', data: globalEntry });

    // Queue Local Log
    const localEntry = this._createLocalLogEntry({
      action,
      tenant_id: context.tenant_id,
      doctype,
      doc_id: docId,
      doc_name: docNameTitle,
      user_id: context.user_id,
      user_name: context.user_name || 'System',
      user_avatar: context.user_avatar,
      diff: action === 'Updated' ? { fields: Object.keys(diff) } : null,
      change_summary: changeSummary
    });
    this.logQueue.push({ type: 'local', doctype, data: localEntry });
  }

  _handleSocialEvent(action, payload, context) {
    const { doctype, doc_id, comment } = payload;
    if (!doctype || !doc_id) return;

    let changeSummary = action === 'COMMENT' ? 'Commented' : action === 'LIKE' ? 'Liked' : 'Unliked';

    // Queue Global Log so it appears in standard audit trail
    const globalEntry = this._createGlobalLogEntry({
      action,
      tenant_id: context.tenant_id,
      doctype,
      doc_id: doc_id,
      doc_name: payload.doc_name || doc_id,
      user_id: context.user_id,
      user_name: context.user_name || 'System',
      change_summary: changeSummary,
      metadata: comment ? { comment } : null
    });
    this.logQueue.push({ type: 'global', data: globalEntry });

    // Queue Local Log
    const localEntry = this._createLocalLogEntry({
      action,
      tenant_id: context.tenant_id,
      doctype,
      doc_id: doc_id,
      doc_name: payload.doc_name || doc_id,
      user_id: context.user_id,
      user_name: context.user_name || 'System',
      user_avatar: context.user_avatar,
      comment: comment || null,
      change_summary: changeSummary
    });
    this.logQueue.push({ type: 'local', doctype, data: localEntry });
  }

  // --- Helpers ---

  _createGlobalLogEntry(data) {
    return {
      id: randomUUID(),
      tenant_id: data.tenant_id || 'system',
      doctype: data.doctype || null,
      doc_id: data.doc_id || null,
      doc_name: data.doc_name || null,
      action: data.action,
      user_id: data.user_id || null,
      user_name: data.user_name || null,
      ip_address: data.ip_address || null,
      user_agent: data.user_agent || null,
      diff: data.diff ? JSON.stringify(data.diff) : null,
      change_summary: data.change_summary || '',
      metadata: data.metadata ? JSON.stringify(data.metadata) : null,
      created_at: new Date()
    };
  }

  _createLocalLogEntry(data) {
    return {
      id: randomUUID(),
      tenant_id: data.tenant_id || 'system',
      doctype: data.doctype,
      doc_id: data.doc_id,
      doc_name: data.doc_name || null,
      action: data.action,
      user_id: data.user_id || null,
      user_name: data.user_name || null,
      user_avatar: data.user_avatar || null,
      comment: data.comment || null,
      diff: data.diff ? JSON.stringify(data.diff) : null,
      change_summary: data.change_summary || '',
      created_at: new Date()
    };
  }

  _computeDiff(oldDoc, newDoc) {
    const diff = {};
    const allKeys = new Set([...Object.keys(oldDoc), ...Object.keys(newDoc)]);
    
    // Standard system fields to ignore in diff
    const ignoreFields = ['modified', 'modified_by', 'updated_at', 'updated_by'];

    for (const key of allKeys) {
      if (ignoreFields.includes(key)) continue;
      
      // Do not log sensitive fields
      if (this.SENSITIVE_FIELDS.includes(key.toLowerCase())) continue;

      if (oldDoc[key] !== newDoc[key]) {
        // Simple equality check, can be expanded for deep object comparison
        diff[key] = { from: oldDoc[key], to: newDoc[key] };
      }
    }
    return diff;
  }

  async _flushLogs() {
    if (this.isFlushing || this.logQueue.length === 0) return;
    
    const knex = DatabaseEngine.getRawConnection();
    if (!knex) return;

    this.isFlushing = true;
    
    const batch = this.logQueue.splice(0, 100);
    const globalLogs = batch.filter(item => item.type === 'global').map(item => item.data);
    const localLogs = batch.filter(item => item.type === 'local');

    try {
      // Write Global Logs
      if (globalLogs.length > 0) {
        await knex('sys_audit_log').insert(globalLogs);
      }

      // Write Local Logs (grouped by doctype table)
      if (localLogs.length > 0) {
        const groupedLocal = {};
        for (const item of localLogs) {
          const tableName = `dt_${item.doctype.toLowerCase().replace(/ /g, '_')}_logs`;
          if (!groupedLocal[tableName]) groupedLocal[tableName] = [];
          groupedLocal[tableName].push(item.data);
        }

        for (const [tableName, logs] of Object.entries(groupedLocal)) {
          // Check if table exists before inserting, or catch and ignore if it doesn't
          // Ignore if local log table doesn't exist
          try {
            await knex(tableName).insert(logs);
          } catch (tableErr) {
            // Local log table might not exist yet if it's a new or system doctype without tracking
          }
        }
      }
    } catch (err) {
      logger.error('Failed to flush audit logs to database:', err);
      // Re-queue
      // this.logQueue.unshift(...batch);
    } finally {
      this.isFlushing = false;
    }
  }

  close() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    this._flushLogs();
    logger.info('Audit Engine closed.');
  }
}

const instance = new AuditEngine();
export default instance;
