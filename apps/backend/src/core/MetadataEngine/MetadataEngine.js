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
  _getCacheKey(doctypeName) {
    return `${CACHE_PREFIX}:${doctypeName}`;
  }

  /**
   * Retrieves a full DocType metadata (including fields) by its name.
   * Checks Cache first, falls back to DB, and repopulates cache.
   * 
   * @param {string} name - DocType name
   * @returns {Promise<Object>}
   */
  async getDocType(name) {
    const cacheKey = this._getCacheKey(name);

    // 1. Try Cache
    if (config.app.env !== 'development') {
      const cachedMeta = await this.cacheEngine.get(cacheKey);
      if (cachedMeta) {
        logger.debug(`Metadata Cache HIT for ${name}`);
        return cachedMeta;
      }
    }

    logger.debug(`Metadata Cache MISS for ${name}. Loading from DB...`);

    let doctype;
    if (typeof name === 'number' || !isNaN(Number(name))) {
      doctype = await this.dbEngine.query('sys_doctype', { includeDeleted: true })
        .where({ id: Number(name) })
        .whereNot('status', 'Deleted')
        .first();
    } else {
      doctype = await this.dbEngine.query('sys_doctype', { includeDeleted: true })
        .where(function() {
          this.where('slug', name).orWhere('table_name', name).orWhere('name', name);
        })
        .whereNot('status', 'Deleted')
        .first();
    }

    if (!doctype) {
      throw new NotFoundError(`DocType '${name}' not found or inactive.`);
    }

    // Fetch Fields
    const fields = await this.dbEngine.query('sys_docfield', { includeDeleted: true })
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
   */
  async invalidate(name) {
    const cacheKey = this._getCacheKey(name);
    await this.cacheEngine.del(cacheKey);
    logger.info(`Invalidated metadata cache for ${name}`);
  }

  /**
   * Gets all active DocTypes (without fields).
   * Used for generating routes or sidebar menus.
   * 
   * @returns {Promise<Array>}
   */
  async getAllDocTypes() {
    const listCacheKey = `${CACHE_PREFIX}:__all_list`;
    
    if (config.app.env !== 'development') {
      const cachedList = await this.cacheEngine.get(listCacheKey);
      if (cachedList) return cachedList;
    }

    const doctypes = await this.dbEngine.query('sys_doctype')
      .where({ status: 'Saved' })
      .select('id', 'name', 'table_name', 'module_id', 'icon');

    if (config.app.env !== 'development') {
      await this.cacheEngine.set(listCacheKey, doctypes, CACHE_TTL);
    }
    
    return doctypes;
  }
}

const instance = new MetadataEngine();
export default instance;
