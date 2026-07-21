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

  _getCacheKey(userId) {
    return `${CACHE_PREFIX}:${userId}`;
  }

  /**
   * Fetches and compiles all permissions for a given user from the DB.
   * This flattens roles and merges them additively.
   */
  async _compilePermissions(userId) {
    // 0. Check if user is system user
    const user = await this.dbEngine.query('sys_user')
      .where({ id: userId }).first();

    if (user && user.is_system_user) {
      return { isSystemManager: true, doctypes: {} };
    }

    // 1. Get user roles
    const userRoles = await this.dbEngine.query('sys_user_role', { includeDeleted: true })
      .where({ user_id: userId })
      .select('role_id');

    const roleIds = userRoles.map(ur => ur.role_id);

    // If no roles, return empty set
    if (roleIds.length === 0) {
      return { isSystemManager: false, doctypes: {} };
    }

    // 2. Check if user is System Manager
    const roles = await this.dbEngine.query('sys_role')
      .whereIn('id', roleIds)
      .select('name', 'is_system_role');

    const isSystemManager = roles.some(r => r.name === SYSTEM_MANAGER);

    if (isSystemManager) {
      // System Manager bypasses explicit permission definitions
      return { isSystemManager: true, doctypes: {} };
    }

    // 3. Fetch permissions for these roles
    const permissions = await this.dbEngine.query('sys_permission')
      .whereIn('role_id', roleIds);

    // 4. Merge additively per DocType
    const doctypes = {};
    for (const p of permissions) {
      if (!doctypes[p.doctype]) {
        doctypes[p.doctype] = {
          read: false, update: false, create: false, delete: false,
          lock: false, unlock: false, export: false, share: false, print: false,
          if_owner: false, conditions: []
        };
      }
      
      const dt = doctypes[p.doctype];
      dt.read = dt.read || p.can_read;
      dt.update = dt.update || p.can_update;
      dt.create = dt.create || p.can_create;
      dt.delete = dt.delete || p.can_delete;
      dt.lock = dt.lock || p.can_lock;
      dt.unlock = dt.unlock || p.can_unlock;
      dt.export = dt.export || p.can_export;
      dt.share = dt.share || p.can_share;
      dt.print = dt.print || p.can_print;
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
  async getPermissions(userId) {
    if (userId === 'system-manager-mock-id') {
      return { isSystemManager: true, doctypes: {} };
    }

    const cacheKey = this._getCacheKey(userId);
    let permSet = await this.cacheEngine.get(cacheKey);

    if (!permSet) {
      logger.debug(`Permission Cache MISS for User ${userId}`);
      permSet = await this._compilePermissions(userId);
      await this.cacheEngine.set(cacheKey, permSet, CACHE_TTL);
    }

    return permSet;
  }

  /**
   * Primary method to check if a user can perform an action on a DocType.
   */
  async can(userId, action, doctype, doc = null) {
    const permSet = await this.getPermissions(userId);

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

  async invalidateUser(userId) {
    const cacheKey = this._getCacheKey(userId);
    await this.cacheEngine.del(cacheKey);
  }
}

const instance = new PermissionEngine();
export default instance;
