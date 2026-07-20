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
   * Retrieves all active workflow transitions for a given DocType.
   * In the refactored schema, sys_workflow rows ARE the transitions (one row = one transition).
   * Returns null if no transitions exist.
   */
  async getActiveWorkflow(doctype, tenantId) {
    const cacheKey = `framee:meta:${tenantId}:workflow:${doctype}`;
    const cached = await this.cacheEngine.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const meta = await this.metaEngine.getDocType(doctype, tenantId);
    if (!meta) return null;

    // In the new schema, sys_workflow holds transitions directly (from_state, to_state, action per row)
    const transitions = await this.dbEngine.getRawConnection()('sys_workflow')
      .where({ doctype: meta.table_name, status: 'Saved', is_deleted: false })
      .orderBy('sort_order', 'asc');

    if (!transitions || transitions.length === 0) return null;

    // Collect unique state names from transitions
    const stateNames = new Set();
    transitions.forEach(t => {
      stateNames.add(t.from_state);
      stateNames.add(t.to_state);
    });

    // Fetch state definitions from sys_state (refactored from sys_workflow_state)
    const states = await this.dbEngine.getRawConnection()('sys_state')
      .whereIn('name', Array.from(stateNames));

    // Collect unique action names
    const actionNames = new Set();
    transitions.forEach(t => actionNames.add(t.action));

    // Fetch action definitions from sys_action (refactored from sys_workflow_action)
    const actions = await this.dbEngine.getRawConnection()('sys_action')
      .whereIn('name', Array.from(actionNames));

    // Determine initial state (the from_state of the first transition, typically 'Draft')
    const initialState = transitions[0]?.from_state || 'Draft';

    const result = {
      doctype: meta.table_name,
      initial_state: initialState,
      states,
      actions,
      transitions: transitions.map(t => ({
        ...t,
        allowed_roles: typeof t.allow_roles === 'string' ? JSON.parse(t.allow_roles) : (t.allow_roles || [])
      }))
    };

    await this.cacheEngine.set(cacheKey, JSON.stringify(result));
    return result;
  }

  /**
   * Called on record insert to set the initial workflow state.
   */
  async setInitialState(doctype, record, tenantId) {
    const workflow = await this.getActiveWorkflow(doctype, tenantId);
    if (workflow) {
      record.status = workflow.initial_state;
    }
  }

  /**
   * Get available transitions for a specific document and user.
   */
  async getAvailableTransitions(doctype, docId, tenantId, user) {
    const workflow = await this.getActiveWorkflow(doctype, tenantId);
    if (!workflow) return [];

    const meta = await this.metaEngine.getDocType(doctype, tenantId);
    const tableName = meta.table_name;

    const parsedId = isNaN(docId) ? docId : Number(docId);
    const doc = await this.dbEngine.query(tableName, tenantId).where({ id: parsedId }).first();
    if (!doc) throw new NotFoundError(`${doctype} not found.`);

    // Current state is stored in doc.status
    const currentState = doc.status || workflow.initial_state;
    if (!currentState) return [];

    // Filter transitions where from_state matches current status
    const possibleTransitions = workflow.transitions.filter(t => t.from_state === currentState);

    const userRoles = user.roles || [];
    const isSysAdmin = user.is_system_user;

    const allowed = possibleTransitions.filter(t => {
      if (isSysAdmin) return true;
      const allowedRoles = t.allowed_roles || [];
      return allowedRoles.some(r => userRoles.includes(r));
    });

    // Resolve state names and action keys for UI
    return allowed.map(t => {
      const nextState = workflow.states.find(s => s.name === t.to_state);
      const actionDetails = workflow.actions.find(a => a.name === t.action);
      
      return {
        ...t,
        next_state: nextState ? nextState.name : t.to_state,
        style: nextState ? nextState.style : 'default',
        action: actionDetails ? actionDetails.name : t.action,
        action_key: actionDetails ? actionDetails.key : null
      };
    });
  }

  /**
   * Execute a workflow transition.
   */
  async executeTransition(doctype, docId, actionName, comment, tenantId, user) {
    const workflow = await this.getActiveWorkflow(doctype, tenantId);
    if (!workflow) throw new ValidationError(`No active workflow for ${doctype}.`);

    const meta = await this.metaEngine.getDocType(doctype, tenantId);
    const tableName = meta.table_name;

    const parsedId = isNaN(docId) ? docId : Number(docId);
    const doc = await this.dbEngine.query(tableName, tenantId).where({ id: parsedId }).first();
    if (!doc) throw new NotFoundError(`${doctype} not found.`);

    const currentState = doc.status || workflow.initial_state;

    // Find the requested transition by action name OR action key
    const transition = workflow.transitions.find(t => {
      if (t.from_state !== currentState) return false;
      const actionDetails = workflow.actions.find(a => a.name === t.action);
      return t.action === actionName ||
             (actionDetails && actionDetails.key === actionName);
    });

    if (!transition) {
      throw new ValidationError(`Invalid transition '${actionName}' from state '${currentState}'.`);
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
    const nextState = transition.to_state;

    const trx = await this.dbEngine.getRawConnection().transaction();
    try {
      // 1. Copy old data to _version table
      if (tableName !== 'sys_docfield') {
        const oldData = { ...doc, doc_id: doc.id, backup_by: user.id, backup_at: new Date() };
        delete oldData.id;
        await trx(`${tableName}_version`).insert(oldData);
      }

      // 2. Update document status
      await trx(tableName)
        .where({ id: parsedId })
        .update({ status: nextState });

      // 3. Insert history to _logs (skip duplicate logs for auto-saved/auto-updated system transitions)
      if (tableName !== 'sys_docfield' && comment !== 'Auto-saved' && comment !== 'Auto-updated') {
        await trx(`${tableName}_logs`).insert({
          doc_id: parsedId,
          status: transition.log_status || nextState,
          content: comment || doc.name || String(parsedId),
          created_by: user.id,
          created_at: new Date()
        });
      }

      await trx.commit();
    } catch (err) {
      await trx.rollback();
      throw err;
    }

    // Emit event
    const docNameTitle = (doc.code ? `${doc.code}${doc.name ? ' - ' + doc.name : ''}` : null) || doc.title || doc.name || doc.id;
    const payload = {
      doctype,
      doc_id: docId,
      doc_name: docNameTitle,
      from_state: currentState,
      to_state: nextState,
      action_name: actionName,
      user_id: user.id,
      comment
    };
    await this.eventEngine.emit(`${doctype}.workflow.transition`, payload, { tenantId, userId: user.id });

    // Invalidate workflow cache so next call picks up fresh state
    await this.cacheEngine.del(`framee:meta:${tenantId}:workflow:${doctype}`);
    await this.cacheEngine.del(`framee:doc:${tenantId}:${doctype}:${docId}`);

    // Return the updated document
    const updatedDoc = await this.dbEngine.query(tableName, tenantId).where({ id: parsedId }).first();
    return updatedDoc;
  }
  
  async getHistory(doctype, docId, tenantId) {
    const meta = await this.metaEngine.getDocType(doctype, tenantId);
    if (!meta) return [];
    
    const tableName = meta.table_name;
    if (tableName === 'sys_docfield') return [];
    
    return this.dbEngine.query(`${tableName}_logs`, tenantId, { includeDeleted: true })
      .where({ doc_id: docId })
      .orderBy('created_at', 'desc');
  }
}

const instance = new WorkflowEngine();
export default instance;
