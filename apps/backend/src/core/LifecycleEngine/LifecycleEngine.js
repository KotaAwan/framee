import Container from '../Container.js';
import { logger } from '../../utils/logger.js';
import { ForbiddenError, ValidationError } from '../../utils/errors.js';

class LifecycleEngine {
  constructor() {
    this.metaEngine = null;
    this.permEngine = null;
  }

  init() {
    logger.info('Initializing Lifecycle Engine...');
    this.metaEngine = Container.resolve('MetadataEngine');
    this.permEngine = Container.resolve('PermissionEngine');
  }

  /**
   * Central gate to check if an action can be performed on a document.
   * Throws errors directly if checks fail.
   */
  async canPerform(action, doctype, tenantId, userId, doc = null, payload = null) {
    // 1. Permission Check
    const hasPermission = await this.permEngine.can(userId, action, doctype, tenantId, doc);
    if (!hasPermission) {
      throw new ForbiddenError(`User lacks permission to ${action} DocType ${doctype}.`);
    }

    // If there is no specific document, permission check is sufficient (e.g. for list/create)
    if (!doc) {
      return true;
    }

    // 2. Lifecycle Configuration Check
    const meta = await this.metaEngine.getDocType(doctype, tenantId);
    if (!meta.has_lifecycle) {
      return true; // No lifecycle rules apply
    }

    // Document Status Check
    const status = doc.status || 'Draft';

    // Disallow ALL writes if Deleted
    if (status === 'Deleted' && action !== 'read') {
      throw new ValidationError(`Cannot ${action} a Deleted document.`);
    }

    // 3. Status Transition Matrix & DocType Config
    switch (action) {
      case 'update':
        if (status === 'Locked' || status === 'Cancelled' || status === 'Archived') {
          throw new ValidationError(`Cannot update document in status: ${status}.`);
        }
        if (status === 'Submitted' && !meta.allow_edit_after_submit) {
          throw new ValidationError(`DocType configuration prevents edit after submit.`);
        }
        // Field-level locking check
        if (status === 'Submitted' && meta.lock_fields_after_submit && payload) {
          const lockedFields = typeof meta.lock_fields_after_submit === 'string' ? JSON.parse(meta.lock_fields_after_submit) : meta.lock_fields_after_submit;
          for (const field of lockedFields) {
            if (payload[field] !== undefined && payload[field] !== doc[field]) {
              throw new ValidationError(`Field '${field}' is locked and cannot be updated after submit.`);
            }
          }
        }
        break;

      case 'delete':
        if (!meta.allow_delete) {
          throw new ValidationError(`DocType configuration prevents deletion.`);
        }
        if (status === 'Submitted' || status === 'Locked') {
          throw new ValidationError(`Cannot delete a Submitted or Locked document. Cancel it first.`);
        }
        break;

      case 'submit':
        if (status !== 'Draft') {
          throw new ValidationError(`Only Draft documents can be submitted.`);
        }
        break;

      case 'cancel':
        if (!meta.allow_cancel) {
          throw new ValidationError(`DocType configuration prevents cancellation.`);
        }
        if (status !== 'Submitted' && status !== 'Locked') {
          throw new ValidationError(`Only Submitted or Locked documents can be cancelled.`);
        }
        break;

      case 'amend':
        if (!meta.allow_amend) {
          throw new ValidationError(`DocType configuration prevents amendment.`);
        }
        if (status !== 'Submitted' && status !== 'Locked' && status !== 'Cancelled') {
          throw new ValidationError(`Cannot amend a document in status: ${status}.`);
        }
        break;

      case 'duplicate':
        if (!meta.allow_duplicate) {
          throw new ValidationError(`DocType configuration prevents duplication.`);
        }
        break;
    }

    return true;
  }
}

const instance = new LifecycleEngine();
export default instance;
