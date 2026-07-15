import { v4 as uuidv4 } from 'uuid';
import Container from '../Container.js';
import { ValidationError, NotFoundError, ForbiddenError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

class WorkflowEngine {
  constructor() {
    this.dbEngine = null;
    this.metaEngine = null;
    this.eventEngine = null;
    this.cacheEngine = null;
  }

  init() {
    logger.info('Initializing Workflow Engine...');
    this.dbEngine = Container.resolve('DatabaseEngine');
    this.metaEngine = Container.resolve('MetadataEngine');
    this.eventEngine = Container.resolve('EventEngine');
    this.cacheEngine = Container.resolve('CacheEngine');
  }

  /**
   * Retrieves the active workflow for a given DocType.
   * Returns null if no active workflow exists.
   */
  async getActiveWorkflow(doctype, tenantId) {
    const cacheKey = `framee:meta:${tenantId}:workflow:${doctype}`;
    const cached = await this.cacheEngine.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const workflow = await this.dbEngine.query('sys_workflow', tenantId, { includeDeleted: true })
      .where({ doctype, is_active: true, is_deleted: false })
      .first();

    if (!workflow) return null;

    const states = await this.dbEngine.query('sys_workflow_state', tenantId, { includeDeleted: true })
      .where({ workflow_id: workflow.id })
      .orderBy('sort_order', 'asc');

    const transitions = await this.dbEngine.query('sys_workflow_transition', tenantId, { includeDeleted: true })
      .where({ workflow_id: workflow.id })
      .orderBy('sort_order', 'asc');

    const result = {
      ...workflow,
      states,
      transitions: transitions.map(t => ({
        ...t,
        allowed_roles: typeof t.allowed_roles === 'string' ? JSON.parse(t.allowed_roles) : t.allowed_roles
      }))
    };

    await this.cacheEngine.set(cacheKey, JSON.stringify(result));
    return result;
  }

  /**
   * Called on record insert to set the initial workflow state.
   * Modifies the record object in place if a workflow applies.
   */
  async setInitialState(doctype, record, tenantId) {
    const workflow = await this.getActiveWorkflow(doctype, tenantId);
    if (workflow) {
      record.workflow_state = workflow.initial_state;
      // Find the state to set docstatus appropriately
      const state = workflow.states.find(s => s.name === workflow.initial_state);
      if (state) {
        record.status = state.document_status || 'Draft';
      }
    }
  }

  /**
   * Get available transitions for a specific document and user.
   */
  async getAvailableTransitions(doctype, docId, tenantId, user) {
    const workflow = await this.getActiveWorkflow(doctype, tenantId);
    if (!workflow) return [];

    const meta = await this.metaEngine.getDocType(doctype, tenantId);
    const tableName = meta.name.startsWith('sys_') ? meta.name : `dt_${meta.name.toLowerCase()}`;

    const doc = await this.dbEngine.query(tableName, tenantId).where({ id: docId }).first();
    if (!doc) throw new NotFoundError(`${doctype} not found.`);

    const currentState = doc.workflow_state;
    if (!currentState) return [];

    // Filter transitions where from_state matches
    const possibleTransitions = workflow.transitions.filter(t => t.from_state === currentState);

    // Filter by user roles
    const userRoles = user.roles || [];
    // User role is list of names or IDs? Usually it's an array of role names in the user object.
    // If user.is_system_user is true, they can do anything.
    const isSysAdmin = user.is_system_user;

    const allowed = possibleTransitions.filter(t => {
      if (isSysAdmin) return true;
      const allowedRoles = t.allowed_roles || [];
      return allowedRoles.some(r => userRoles.includes(r));
    });

    return allowed;
  }

  /**
   * Execute a workflow transition.
   */
  async executeTransition(doctype, docId, actionKey, comment, tenantId, user) {
    const workflow = await this.getActiveWorkflow(doctype, tenantId);
    if (!workflow) throw new ValidationError(`No active workflow for ${doctype}.`);

    const meta = await this.metaEngine.getDocType(doctype, tenantId);
    const tableName = meta.name.startsWith('sys_') ? meta.name : `dt_${meta.name.toLowerCase()}`;

    const doc = await this.dbEngine.query(tableName, tenantId).where({ id: docId }).first();
    if (!doc) throw new NotFoundError(`${doctype} not found.`);

    const currentState = doc.workflow_state || workflow.initial_state;

    // Find the requested transition
    const transition = workflow.transitions.find(t => t.from_state === currentState && t.action_key === actionKey);
    if (!transition) {
      throw new ValidationError(`Invalid transition '${actionKey}' from state '${currentState}'.`);
    }

    // Role check
    const isSysAdmin = user.is_system_user;
    if (!isSysAdmin) {
      const allowedRoles = transition.allowed_roles || [];
      const userRoles = user.roles || [];
      if (!allowedRoles.some(r => userRoles.includes(r))) {
        throw new ForbiddenError(`You do not have permission to execute this action.`);
      }
    }

    // Comment check
    if (transition.require_comment && (!comment || comment.trim() === '')) {
      throw new ValidationError(`A comment is required for this action.`);
    }

    // Condition check
    if (transition.condition_field) {
      const fieldVal = String(doc[transition.condition_field]);
      const expectedVal = String(transition.condition_value);
      if (fieldVal !== expectedVal) {
        throw new ValidationError(`Condition not met: ${transition.condition_field} must be ${expectedVal}.`);
      }
    }

    // Execute transition
    const nextState = workflow.states.find(s => s.name === transition.to_state);
    if (!nextState) throw new ValidationError(`Target state '${transition.to_state}' does not exist.`);

    const trx = await this.dbEngine.getRawConnection().transaction();
    try {
      // Update document
      await trx(tableName)
        .where({ id: docId, tenant_id: tenantId })
        .update({
          workflow_state: nextState.name,
          status: nextState.document_status || doc.status,
          updated_by: user.id,
          updated_at: new Date()
        });

      // Insert history
      await trx('sys_workflow_history').insert({
        id: uuidv4(),
        tenant_id: tenantId,
        doctype,
        doc_id: docId,
        workflow_id: workflow.id,
        from_state: currentState,
        to_state: nextState.name,
        action: transition.action,
        user_id: user.id,
        comment: comment || null,
        created_at: new Date()
      });

      await trx.commit();
    } catch (err) {
      await trx.rollback();
      throw err;
    }

    // Emit event
    const payload = {
      doc_id: docId,
      from_state: currentState,
      to_state: nextState.name,
      user_id: user.id,
      comment
    };
    
    await this.eventEngine.emit(`${doctype}.workflow.${actionKey}`, payload, { tenant_id: tenantId, doctype });

    if (nextState.is_terminal && nextState.document_status === 'Approved') {
      await this.eventEngine.emit(`${doctype}.workflow.approved`, payload, { tenant_id: tenantId });
    } else if (nextState.is_terminal && nextState.document_status === 'Rejected') {
      await this.eventEngine.emit(`${doctype}.workflow.rejected`, payload, { tenant_id: tenantId });
    }

    // Return the updated document
    const updatedDoc = await this.dbEngine.query(tableName, tenantId).where({ id: docId }).first();
    return updatedDoc;
  }
  
  async getHistory(doctype, docId, tenantId) {
    return this.dbEngine.query('sys_workflow_history', tenantId)
      .where({ doctype, doc_id: docId })
      .orderBy('created_at', 'desc');
  }
}

const instance = new WorkflowEngine();
export default instance;
