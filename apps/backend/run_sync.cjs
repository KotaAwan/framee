const path = require('path');
(async () => {
  const { config } = await import('./src/config/env.js');
  const DatabaseEngine = (await import('./src/core/DatabaseEngine/DatabaseEngine.js')).default;
  await DatabaseEngine.init();
  const TranslationSyncService = (await import('./src/services/TranslationSyncService.js')).default;
  await TranslationSyncService.syncTranslations();
  console.log('done');
  process.exit(0);
})();
