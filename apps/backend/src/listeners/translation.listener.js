import EventEngine from '../core/EventEngine/EventEngine.js';
import TranslationSyncService from '../services/TranslationSyncService.js';
import { logger } from '../utils/logger.js';

export function initializeTranslationListener() {
  const syncTranslation = async (event, payload, context) => {
    logger.info(`Translation listener triggered by event: ${event}`);
    await TranslationSyncService.syncTranslations();
  };

  // Listen to translation changes
  EventEngine.on('sys_translation.after_insert', syncTranslation);
  EventEngine.on('sys_translation.after_update', syncTranslation);
  EventEngine.on('sys_translation.after_delete', syncTranslation);

  // Listen to language changes as they affect the JSON structure
  EventEngine.on('sys_language.after_insert', syncTranslation);
  EventEngine.on('sys_language.after_update', syncTranslation);
  EventEngine.on('sys_language.after_delete', syncTranslation);

  logger.info('Translation listener initialized');
}
