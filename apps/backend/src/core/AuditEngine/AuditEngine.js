import { randomUUID } from 'crypto';
import { logger } from '../../utils/logger.js';
import DatabaseEngine from '../DatabaseEngine/DatabaseEngine.js';
import EventEngine from '../EventEngine/EventEngine.js';
import { config } from '../../config/env.js';

class AuditEngine {
  constructor() {
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

    // Subscribe to Workflow Transitions
    EventEngine.on('*.workflow.transition', (p, c) => this._handleWorkflowEvent('Transition', p, c));
    
    logger.info('Audit Engine initialized successfully.');
  }

  // --- Event Handlers ---

  async _handleSystemEvent(action, payload, context) {
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
    try {
      const knex = DatabaseEngine.getRawConnection();
      await knex('sys_audit_log').insert(entry);
    } catch (e) {
      logger.error('Failed to insert system audit log:', e);
    }
  }

  async _handleDocumentEvent(action, payload, context) {
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

    const docId = doc.id;
    const docNameTitle = (doc.code ? `${doc.code}${doc.name ? ' - ' + doc.name : ''}` : null) || doc.title || doc.name || docId;

    // Insert Global Log synchronously
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
    try {
      const knex = DatabaseEngine.getRawConnection();
      await knex('sys_audit_log').insert(globalEntry);
    } catch (e) {
      logger.error('Failed to insert document audit log:', e);
    }
  }

  async _handleSocialEvent(action, payload, context) {
    const { doctype, doc_id, comment } = payload;
    if (!doctype || !doc_id) return;

    let changeSummary = action === 'COMMENT' ? 'Commented' : action === 'LIKE' ? 'Liked' : 'Unliked';



    // Insert Global Log synchronously
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
    try {
      const knex = DatabaseEngine.getRawConnection();
      await knex('sys_audit_log').insert(globalEntry);
    } catch (e) {
      logger.error('Failed to insert social audit log:', e);
    }

    // Insert into local _logs table
    try {
      const metaEngine = (await import('../Container.js')).default.resolve('MetadataEngine');
      const meta = await metaEngine.getDocType(doctype, context.tenant_id);
      if (meta && meta.table_name && meta.table_name !== 'sys_docfield') {
        const knex = DatabaseEngine.getRawConnection();
        await knex(`${meta.table_name}_logs`).insert({
          doc_id: doc_id,
          status: changeSummary,
          content: comment || payload.doc_name || null,
          created_by: context.user_id,
          created_at: new Date()
        });
      }
    } catch (e) {
      logger.error('Failed to insert social event to local log:', e);
    }
  }

  async _handleWorkflowEvent(action, payload, context) {
    const { doc_id, doctype, from_state_id, to_state_id, comment, action_name } = payload;
    if (!doctype || !doc_id) return;

    let changeSummary = `Workflow Transition: ${action_name || 'State changed'}`;

    // Insert Global Log synchronously
    const globalEntry = this._createGlobalLogEntry({
      action: action_name || 'Transition',
      tenant_id: context.tenant_id,
      doctype,
      doc_id: doc_id,
      doc_name: payload.doc_name || doc_id,
      user_id: context.user_id,
      user_name: context.user_name || 'System',
      change_summary: changeSummary,
      metadata: comment ? { comment, from_state_id, to_state_id } : { from_state_id, to_state_id }
    });
    try {
      const knex = DatabaseEngine.getRawConnection();
      await knex('sys_audit_log').insert(globalEntry);
    } catch (e) {
      logger.error('Failed to insert workflow audit log:', e);
    }
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

  close() {
    logger.info('Audit Engine closed.');
  }
}

const instance = new AuditEngine();
export default instance;
