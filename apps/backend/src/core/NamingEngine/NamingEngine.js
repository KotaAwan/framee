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
   * Generates a unique CODE based on the DocType's auto_code rule.
   * 
   * Supported formats:
   * - 'UUID' or null: standard UUID
   * - 'field:[fieldname]': value of the specified field
   * - 'naming_series:[prefix]': e.g., 'naming_series:INV-.YYYY.-.####'
   */
  async generateCode(meta, record, tableName) {
    const autoname = meta.auto_code || 'UUID';

    // 1. UUID fallback
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
      return String(value).trim();
    }

    // 3. Naming Series (e.g. MOD-.####)
    if (autoname.startsWith('naming_series:') || autoname.includes('.#')) {
      const pattern = autoname.startsWith('naming_series:') ? autoname.split(':')[1] : autoname;
      return await this._generateFromSeries(pattern, tableName);
    }

    // Fallback
    return uuidv4();
  }

  /**
   * Evaluates the series pattern and increments the sequence securely by querying the max code.
   */
  async _generateFromSeries(pattern, tableName) {
    const knex = this.dbEngine.getRawConnection();

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
      } else if (part.startsWith('X')) {
        digitsCount = part.length;
      } else {
        parsedPrefix += part;
      }
    }

    let nextValue = 1;
    
    // We lock the table to prevent race conditions during insert
    await knex.transaction(async (trx) => {
      const lastRecord = await trx(tableName)
        .where('code', 'like', `${parsedPrefix}%`)
        .orderBy('code', 'desc')
        .forUpdate()
        .first();

      if (lastRecord && lastRecord.code) {
        const lastSequenceStr = lastRecord.code.replace(parsedPrefix, '');
        const lastSeq = parseInt(lastSequenceStr, 10);
        if (!isNaN(lastSeq)) {
          nextValue = lastSeq + 1;
        }
      }
    });

    const sequenceStr = String(nextValue).padStart(digitsCount, '0');
    return `${parsedPrefix}${sequenceStr}`;
  }
}

const instance = new NamingEngine();
export default instance;
