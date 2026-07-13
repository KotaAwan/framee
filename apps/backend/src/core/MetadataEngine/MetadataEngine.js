import Container from '../Container.js';
import { logger } from '../../utils/logger.js';
import { NotFoundError } from '../../utils/errors.js';

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
    const cachedMeta = await this.cacheEngine.get(cacheKey);
    if (cachedMeta) {
      logger.debug(`Metadata Cache HIT for ${name} (Tenant: ${tenantId})`);
      return cachedMeta;
    }

    logger.debug(`Metadata Cache MISS for ${name} (Tenant: ${tenantId}). Loading from DB...`);

    // 2. Fetch from DB
    // Fetch DocType
    const doctype = await this.dbEngine.query('sys_doctype', tenantId)
      .where({ name, is_active: true })
      .first();

    if (!doctype) {
      throw new NotFoundError(`DocType '${name}' not found or inactive for this tenant.`);
    }

    // Fetch Fields
    const fields = await this.dbEngine.query('sys_docfield', tenantId, { includeDeleted: true })
      .where({ doctype_id: doctype.id })
      .orderBy('sort_order', 'asc');

    const metadata = {
      ...doctype,
      fields: fields || []
    };

    // 3. Populate Cache
    await this.cacheEngine.set(cacheKey, metadata, CACHE_TTL);

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
    // We could cache this list as well, but for now we just query the DB.
    // It's a lightweight query since it doesn't join fields.
    const listCacheKey = `${CACHE_PREFIX}:${tenantId}:__all_list`;
    
    const cachedList = await this.cacheEngine.get(listCacheKey);
    if (cachedList) return cachedList;

    const doctypes = await this.dbEngine.query('sys_doctype', tenantId)
      .where({ is_active: true })
      .select('id', 'name', 'label', 'module_id', 'is_submittable');

    await this.cacheEngine.set(listCacheKey, doctypes, CACHE_TTL);
    
    return doctypes;
  }
}

const instance = new MetadataEngine();
export default instance;
