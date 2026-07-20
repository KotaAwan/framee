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
        if (['Saved', 'Deleted'].includes(status)) {
          throw new ValidationError(`Cannot update document in status: ${status}.`);
        }
        break;

      case 'delete':
        if (!meta.allow_delete) {
          throw new ValidationError(`DocType configuration prevents deletion.`);
        }
        if (status === 'Saved') {
          throw new ValidationError(`Cannot delete a Saved document. Unlock it first.`);
        }
        break;

      case 'submit':
        if (status !== 'Draft' && status !== 'New') {
          throw new ValidationError(`Only New or Draft documents can be saved/submitted.`);
        }
        break;

      case 'cancel':
        if (!meta.allow_cancel) {
          throw new ValidationError(`DocType configuration prevents cancellation.`);
        }
        if (status !== 'Saved') {
          throw new ValidationError(`Only Saved documents can be unlocked.`);
        }
        break;

      case 'amend':
        if (!meta.allow_amend) {
          throw new ValidationError(`DocType configuration prevents amendment.`);
        }
        if (status !== 'Submitted' && status !== 'Cancelled') {
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
