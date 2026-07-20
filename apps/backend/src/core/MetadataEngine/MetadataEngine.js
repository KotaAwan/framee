import Container from '../Container.js';
import { logger } from '../../utils/logger.js';
import { NotFoundError } from '../../utils/errors.js';
import { config } from '../../config/env.js';

const CACHE_PREFIX = 'framee:meta';
const CACHE_TTL = 3600; // 1 hour

class MetadataEngine {
  constructor() {
    this.dbEngine = null;
    this.cacheEngine = null;
  }

  /**
   * Initializes the engine and resolves dependencies from the Container.
   */
  init() {
    logger.info('Initializing Metadata Engine...');
    this.dbEngine = Container.resolve('DatabaseEngine');
    this.cacheEngine = Container.resolve('CacheEngine');
  }

  /**
   * Gets the cache key for a specific DocType.
   */
  _getCacheKey(tenantId, doctypeName) {
    return `${CACHE_PREFIX}:${tenantId}:${doctypeName}`;
  }

  /**
   * Retrieves a full DocType metadata (including fields) by its name and tenant ID.
   * Checks Cache first, falls back to DB, and repopulates cache.
   * 
   * @param {string} name - DocType name
   * @param {string} tenantId - Tenant ID
   * @returns {Promise<Object>}
   */
  async getDocType(name, tenantId) {
    const cacheKey = this._getCacheKey(tenantId, name);

    // 1. Try Cache
    if (config.app.env !== 'development') {
      const cachedMeta = await this.cacheEngine.get(cacheKey);
      if (cachedMeta) {
        logger.debug(`Metadata Cache HIT for ${name} (Tenant: ${tenantId})`);
        return cachedMeta;
      }
    }

    logger.debug(`Metadata Cache MISS for ${name} (Tenant: ${tenantId}). Loading from DB...`);

    const SYSTEM_TENANT = config.app.systemTenantId;
    const isSystemDocType = name.startsWith('sys_');
    const queryTenantId = isSystemDocType ? SYSTEM_TENANT : tenantId;

    // 2. Fetch from DB
    // Fetch DocType
    // The parameter `name` could be a table_name (like sys_user) or an ID (for internally linked stuff), but usually it's table_name.
    let doctype;
    if (typeof name === 'number' || !isNaN(Number(name))) {
      doctype = await this.dbEngine.query('sys_doctype', queryTenantId)
        .where({ id: Number(name), status: 'Saved' })
        .first();
    } else {
      doctype = await this.dbEngine.query('sys_doctype', queryTenantId)
        .where({ table_name: name, status: 'Saved' })
        .first();
    }

    if (!doctype) {
      throw new NotFoundError(`DocType '${name}' not found or inactive for this tenant.`);
    }

    // Fetch Fields
    const fields = await this.dbEngine.query('sys_docfield', queryTenantId, { includeDeleted: true })
      .where({ doctype: doctype.table_name })
      .orderBy('sort_order', 'asc');

    const metadata = {
      ...doctype,
      fields: (fields || []).map(f => {
        if (f.options && typeof f.options === 'string') {
          if (f.options.includes('\n')) f.options = f.options.split('\n').map(s=>s.trim()).filter(Boolean);
          else if (f.options.includes(',')) f.options = f.options.split(',').map(s=>s.trim()).filter(Boolean);
          else f.options = [f.options];
        }
        return f;
      })
    };

    // 3. Populate Cache
    if (config.app.env !== 'development') {
      await this.cacheEngine.set(cacheKey, metadata, CACHE_TTL);
    }

    return metadata;
  }

  /**
   * Invalidates the cache for a specific DocType.
   * Called by EventEngine when a DocType or DocField is saved/deleted.
   * 
   * @param {string} name 
   * @param {string} tenantId 
   */
  async invalidate(name, tenantId) {
    const cacheKey = this._getCacheKey(tenantId, name);
    await this.cacheEngine.del(cacheKey);
    logger.info(`Invalidated metadata cache for ${name} (Tenant: ${tenantId})`);
  }

  /**
   * Gets all active DocTypes for a tenant (without fields).
   * Used for generating routes or sidebar menus.
   * 
   * @param {string} tenantId 
   * @returns {Promise<Array>}
   */
  async getAllDocTypes(tenantId) {
    const listCacheKey = `${CACHE_PREFIX}:${tenantId}:__all_list`;
    
    if (config.app.env !== 'development') {
      const cachedList = await this.cacheEngine.get(listCacheKey);
      if (cachedList) return cachedList;
    }

    const SYSTEM_TENANT = config.app.systemTenantId;
    
    // Fetch both system doctypes and tenant-specific doctypes
    const doctypes = await this.dbEngine.getRawConnection()('sys_doctype')
      .whereIn('tenant_id', [SYSTEM_TENANT, tenantId])
      .where({ is_active: true, is_deleted: false })
      .select('id', 'name', 'label', 'module_id', 'is_submittable');

    if (config.app.env !== 'development') {
      await this.cacheEngine.set(listCacheKey, doctypes, CACHE_TTL);
    }
    
    return doctypes;
  }
}

const instance = new MetadataEngine();
export default instance;
