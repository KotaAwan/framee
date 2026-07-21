# Translation Sync Mechanism

## Overview
The application uses a central database table (`sys_translation`) to store all application translations. To ensure high performance and easy integration with the React/Next.js frontend, we use an automated synchronization mechanism that exports database translations into static JSON files.

## Workflow

1. **Database Storage (`sys_translation`)**:
   Translations are managed via the standard CRUDEngine for the `sys_translation` Document Type.

2. **Event Listeners (`apps/backend/src/listeners/translation.listener.js`)**:
   The `EventEngine` listens for CRUD events (`after_insert`, `after_update`, `after_delete`) on both `sys_translation` and `sys_language`.

3. **Sync Service (`apps/backend/src/services/TranslationSyncService.js`)**:
   When an event is triggered, the `TranslationSyncService` queries all active languages and translations. It constructs a nested JSON object grouped by language code (e.g., `en`, `id`).

4. **JSON Export (`apps/frontend/src/locales/translations.json`)**:
   The service writes the constructed JSON directly into the frontend repository's `src/locales` directory. During local development, Next.js detects the file change and automatically hot-reloads the frontend.

5. **Frontend Usage (`apps/frontend/src/hooks/useTranslation.js`)**:
   The `useTranslation` hook imports `translations.json`. Instead of hardcoding fallback dictionaries, it uses the auto-generated JSON file as the source of truth, ensuring the UI always reflects the latest database changes without manual frontend updates.

## Manual Sync
If translations fall out of sync, you can run the sync service manually from the backend:
```bash
# Example script to trigger a sync manually
node run_sync.cjs
```
