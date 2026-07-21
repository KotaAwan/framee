import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import DatabaseEngine from '../core/DatabaseEngine/DatabaseEngine.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Target path in the frontend repository
const FRONTEND_LOCALES_DIR = path.resolve(__dirname, '../../../frontend/src/locales');
const TARGET_FILE = path.join(FRONTEND_LOCALES_DIR, 'translations.json');

class TranslationSyncService {
  constructor() {
    this.isSyncing = false;
  }

  async syncTranslations() {
    if (this.isSyncing) return;
    this.isSyncing = true;
    
    try {
      const knex = DatabaseEngine.getRawConnection();
      
      // Get all languages
      const languages = await knex('sys_language').where({ is_deleted: 0 });
      
      // Get all translations
      const translations = await knex('sys_translation').where({ is_deleted: 0 });
      
      // Construct the JSON structure
      const dictionary = {};
      
      // Map names to language codes (for frontend compatibility)
      const langCodeMap = {};
      languages.forEach(lang => {
        let code = lang.name.toLowerCase().substring(0, 2);
        if (lang.name.toLowerCase() === 'indonesian') code = 'id';
        if (lang.name.toLowerCase() === 'english') code = 'en';
        langCodeMap[lang.id] = code;
        dictionary[code] = {};
      });

      // Populate dictionary
      translations.forEach(trans => {
        const langCode = langCodeMap[trans.language_id];
        if (langCode && trans.name) {
          dictionary[langCode][trans.name] = trans.translated_text || trans.name;
        }
      });
      
      // Ensure the directory exists
      await fs.mkdir(FRONTEND_LOCALES_DIR, { recursive: true });
      
      // Write the file
      await fs.writeFile(TARGET_FILE, JSON.stringify(dictionary, null, 2), 'utf-8');
      logger.info(`Successfully synced translations to ${TARGET_FILE}`);
      
    } catch (err) {
      logger.error('Failed to sync translations:', err);
    } finally {
      this.isSyncing = false;
    }
  }
}

const instance = new TranslationSyncService();
export default instance;
