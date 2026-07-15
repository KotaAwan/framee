import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger.js';
import Container from '../Container.js';
import { ValidationError } from '../../utils/errors.js';

class NamingEngine {
  constructor() {
    this.dbEngine = null;
  }

  init() {
    logger.info('Initializing Naming Engine...');
    this.dbEngine = Container.resolve('DatabaseEngine');
  }

  /**
   * Generates a unique ID based on the DocType's autoname rule.
   * 
   * Supported formats:
   * - 'UUID' or null: standard UUID
   * - 'field:[fieldname]': value of the specified field
   * - 'naming_series:[prefix]': e.g., 'naming_series:INV-.YYYY.-.####'
   */
  async generateId(meta, record, tenantId) {
    const autoname = meta.autoname || 'UUID';

    // 1. UUID
    if (autoname.toUpperCase() === 'UUID') {
      return uuidv4();
    }

    // 2. Field-based
    if (autoname.startsWith('field:')) {
      const fieldname = autoname.split(':')[1];
      const value = record[fieldname];
      if (!value) {
        throw new ValidationError(`Field '${fieldname}' is required for naming ${meta.name}.`);
      }
      // sanitize value to be a safe ID
      return String(value).trim();
    }

    // 3. Naming Series
    if (autoname.startsWith('naming_series:')) {
      const pattern = autoname.split(':')[1];
      return await this._generateFromSeries(pattern, tenantId);
    }

    // Fallback
    return uuidv4();
  }

  /**
   * Evaluates the series pattern and increments the sequence securely.
   */
  async _generateFromSeries(pattern, tenantId) {
    const knex = this.dbEngine.getRawConnection();

    // Parse the pattern to extract prefix and digits count
    // Example: 'INV-.YYYY.-.####' -> prefix = 'INV-2024-', digits = 4
    let parsedPrefix = '';
    let digitsCount = 4; // default

    const parts = pattern.split('.');
    for (const part of parts) {
      if (part === 'YYYY') {
        parsedPrefix += new Date().getFullYear();
      } else if (part === 'YY') {
        parsedPrefix += String(new Date().getFullYear()).slice(-2);
      } else if (part === 'MM') {
        parsedPrefix += String(new Date().getMonth() + 1).padStart(2, '0');
      } else if (part === 'DD') {
        parsedPrefix += String(new Date().getDate()).padStart(2, '0');
      } else if (part.startsWith('#')) {
        digitsCount = part.length;
      } else {
        parsedPrefix += part;
      }
    }

    // Execute atomic increment in a transaction
    let nextValue = 1;
    
    await knex.transaction(async (trx) => {
      // Try to lock the row
      const existing = await trx('sys_series')
        .where({ tenant_id: tenantId, prefix: parsedPrefix })
        .forUpdate()
        .first();

      if (existing) {
        nextValue = existing.current + 1;
        await trx('sys_series')
          .where({ tenant_id: tenantId, prefix: parsedPrefix })
          .update({ current: nextValue, updated_at: new Date() });
      } else {
        await trx('sys_series').insert({
          tenant_id: tenantId,
          prefix: parsedPrefix,
          current: 1,
          updated_at: new Date()
        });
      }
    });

    const sequenceStr = String(nextValue).padStart(digitsCount, '0');
    return `${parsedPrefix}${sequenceStr}`;
  }
}

const instance = new NamingEngine();
export default instance;
