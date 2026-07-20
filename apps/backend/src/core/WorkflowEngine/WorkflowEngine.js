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

    const meta = await this.metaEngine.getDocType(doctype, tenantId);
    if (!meta) return null;

    const workflow = await this.dbEngine.query('sys_workflow', tenantId, { includeDeleted: true })
      .where({ doctype: meta.table_name, status: 'Active', is_deleted: false })
      .first();

    if (!workflow) return null;

    const transitions = await this.dbEngine.query('sys_workflow_transition', tenantId, { includeDeleted: true })
      .where({ doctype: meta.table_name, status: 'Active', is_deleted: false })
      .orderBy('sort_order', 'asc');

    // We no longer need to fetch states by ID because they are stored as strings (names) directly in transition
    // But we still might want to fetch state definitions if we need styles, etc.
    const stateNames = new Set();
    stateNames.add(workflow.initial_state);
    transitions.forEach(t => {
      stateNames.add(t.from_state);
      stateNames.add(t.to_state);
    });

    const states = await this.dbEngine.query('sys_workflow_state', tenantId, { includeDeleted: true })
      .whereIn('name', Array.from(stateNames));

    const actionIds = new Set();
    transitions.forEach(t => actionIds.add(t.action));

    const actions = await this.dbEngine.query('sys_workflow_action', tenantId, { includeDeleted: true })
      .whereIn('name', Array.from(actionIds));

    const result = {
      ...workflow,
      states,
      actions,
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

    const doc = await this.dbEngine.query(tableName, tenantId).where({ id: docId }).first();
    if (!doc) throw new NotFoundError(`${doctype} not found.`);

    // Current state is stored in doc.status
    const currentState = doc.status || workflow.initial_state;
    if (!currentState) return [];

    // Filter transitions where from_state matches
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

    const doc = await this.dbEngine.query(tableName, tenantId).where({ id: docId }).first();
    if (!doc) throw new NotFoundError(`${doctype} not found.`);

    const currentState = doc.status || workflow.initial_state;

    // Find the requested transition directly by action name
    const transition = workflow.transitions.find(t => t.from_state === currentState && t.action === actionName);
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

      // 2. Update document
      await trx(tableName)
        .where({ id: docId })
        .update({
          status: nextState
        });

      // 3. Insert history to _logs
      if (tableName !== 'sys_docfield') {
        await trx(`${tableName}_logs`).insert({
          doc_id: docId,
          status: nextState, // Update this to match the new state instead of targetAction.name as targetAction.name is something like 'Submit' but status should be 'Submitted'
          content: comment || doc.name,
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
      action_name: targetAction.name,
      user_id: user.id,
      comment
    };
    await this.eventEngine.emit(`${doctype}.workflow.transition`, payload, { tenantId, userId: user.id });

    // Invalidate cache
    await this.cacheEngine.del(`framee:doc:${tenantId}:${doctype}:${docId}`);

    // Return the updated document
    const updatedDoc = await this.dbEngine.query(tableName, tenantId).where({ id: docId }).first();
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
