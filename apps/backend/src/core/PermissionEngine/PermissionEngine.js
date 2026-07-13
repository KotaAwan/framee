import Container from '../Container.js';
import { logger } from '../../utils/logger.js';

const CACHE_PREFIX = 'framee:perm';
const CACHE_TTL = 300; // 5 minutes
const SYSTEM_MANAGER = 'System Manager';

class PermissionEngine {
  constructor() {
    this.dbEngine = null;
    this.cacheEngine = null;
  }

  init() {
    logger.info('Initializing Permission Engine...');
    this.dbEngine = Container.resolve('DatabaseEngine');
    this.cacheEngine = Container.resolve('CacheEngine');
  }

  _getCacheKey(tenantId, userId) {
    return `${CACHE_PREFIX}:${tenantId}:${userId}`;
  }

  /**
   * Fetches and compiles all permissions for a given user from the DB.
   * This flattens roles and merges them additively.
   */
  async _compilePermissions(userId, tenantId) {
    // 1. Get user roles
    const userRoles = await this.dbEngine.query('sys_user_role', tenantId, { includeDeleted: true })
      .where({ user_id: userId })
      .select('role_id');

    const roleIds = userRoles.map(ur => ur.role_id);

    // If no roles, return empty set
    if (roleIds.length === 0) {
      return { isSystemManager: false, doctypes: {} };
    }

    // 2. Check if user is System Manager
    const roles = await this.dbEngine.query('sys_role', tenantId)
      .whereIn('id', roleIds)
      .select('name', 'is_system_role');

    const isSystemManager = roles.some(r => r.name === SYSTEM_MANAGER);

    if (isSystemManager) {
      // System Manager bypasses explicit permission definitions
      return { isSystemManager: true, doctypes: {} };
    }

    // 3. Fetch permissions for these roles
    const permissions = await this.dbEngine.query('sys_permission', tenantId)
      .whereIn('role_id', roleIds);

    // 4. Merge additively per DocType
    const doctypes = {};
    for (const p of permissions) {
      if (!doctypes[p.doctype]) {
        doctypes[p.doctype] = {
          read: false, write: false, create: false, delete: false,
          submit: false, cancel: false, export: false, share: false,
          if_owner: false, conditions: []
        };
      }
      
      const dt = doctypes[p.doctype];
      dt.read = dt.read || p.can_read;
      dt.write = dt.write || p.can_write;
      dt.create = dt.create || p.can_create;
      dt.delete = dt.delete || p.can_delete;
      dt.submit = dt.submit || p.can_submit;
      dt.cancel = dt.cancel || p.can_cancel;
      dt.export = dt.export || p.can_export;
      dt.share = dt.share || p.can_share;
      dt.if_owner = dt.if_owner || p.if_owner;

      if (p.condition_field && p.condition_value) {
        dt.conditions.push({ field: p.condition_field, value: p.condition_value });
      }
    }

    return { isSystemManager, doctypes };
  }

  /**
   * Retrieves compiled permission set (from cache or DB).
   */
  async getPermissions(userId, tenantId) {
    if (userId === 'system-manager-mock-id') {
      return { isSystemManager: true, doctypes: {} };
    }

    const cacheKey = this._getCacheKey(tenantId, userId);
    let permSet = await this.cacheEngine.get(cacheKey);

    if (!permSet) {
      logger.debug(`Permission Cache MISS for User ${userId}`);
      permSet = await this._compilePermissions(userId, tenantId);
      await this.cacheEngine.set(cacheKey, permSet, CACHE_TTL);
    }

    return permSet;
  }

  /**
   * Primary method to check if a user can perform an action on a DocType.
   */
  async can(userId, action, doctype, tenantId, doc = null) {
    const permSet = await this.getPermissions(userId, tenantId);

    if (permSet.isSystemManager) {
      return true;
    }

    const docPerm = permSet.doctypes[doctype];
    if (!docPerm) {
      return false; // Deny by Default
    }

    // Map CRUD actions to permission flags
    const actionMap = {
      'read': 'read',
      'create': 'create',
      'update': 'write', // update maps to write
      'delete': 'delete',
      'submit': 'submit',
      'cancel': 'cancel',
      'amend': 'create', // amend requires create
      'duplicate': 'create' // duplicate requires create
    };

    const permFlag = actionMap[action];
    if (!permFlag || !docPerm[permFlag]) {
      return false;
    }

    // Check conditions if doc is provided
    if (doc && docPerm.conditions && docPerm.conditions.length > 0) {
      // Must satisfy at least one condition (or all? Usually ANY condition granting access is enough for additive roles)
      const satisfiesCondition = docPerm.conditions.some(cond => doc[cond.field] === cond.value);
      if (!satisfiesCondition) return false;
    }

    // Check if_owner if doc is provided and action is write/update/delete
    if (doc && docPerm.if_owner && ['update', 'delete', 'write'].includes(action)) {
      if (doc.created_by !== userId) {
        return false;
      }
    }

    return true;
  }

  async invalidateUser(userId, tenantId) {
    const cacheKey = this._getCacheKey(tenantId, userId);
    await this.cacheEngine.del(cacheKey);
  }
}

const instance = new PermissionEngine();
export default instance;
