# 04-05 Plugin Architecture

## Purpose

Documents how the Plugin Architecture works in Framee. The primary goal is **"Core never imports plugin code"**. Additional features, third-party integrations, or specific ERP modules (HR, POS, Manufacturing) must be built as Plugins without modifying the Framee core source code.

---

## 1. Extension Mechanisms

Framee provides 3 primary mechanisms for Plugins to interact with Core:

1. **Event Hooks (Event Engine)**: React before/after data is saved.
2. **Metadata Injection**: Add new DocTypes, or inject custom DocFields into existing DocTypes (Custom Fields).
3. **Route & Service Registration**: Add new API endpoints.

---

## 2. Plugin Structure

Each plugin is an npm module or a subdirectory in `/packages/plugins/`.

Example `plugin.json` (Manifest):
```json
{
  "name": "framee-plugin-pos",
  "version": "1.0.0",
  "title": "Point of Sale",
  "description": "Retail POS integration",
  "author": "Kotaawan",
  "dependencies": {
    "framee-core": ">=1.0.0"
  },
  "hooks": "backend/hooks.js",
  "metadata": "metadata/"
}
```

---

## 3. Metadata Injection

When a plugin is installed, the Metadata Engine reads the plugin's `metadata/` folder.
If a DocType definition exists (e.g., `pos_invoice.json`), the system will:
1. Insert it into `sys_doctype` and `sys_docfield` with a flag `plugin_name = 'framee-plugin-pos'`.
2. The Database Engine automatically creates the `dt_pos_invoice` table.
3. The API Engine automatically exposes the route `/api/v1/doc/PosInvoice`.

All of this happens without writing a single line of controller/service code!

---

## 4. Event Hooks (Logic Intervention)

If a plugin wants to alter standard behavior (e.g., validate a discount when a Sales Invoice is created), the plugin registers a function with the Event Engine.

Example `backend/hooks.js`:
```javascript
export default function registerHooks(eventEngine, container) {
  
  // Before Insert Hook
  eventEngine.on('SalesInvoice.before_insert', async (context) => {
    const { doc, tenant_id } = context;
    if (doc.discount_amount > doc.total_amount) {
      throw new Error("Discount cannot exceed the total invoice amount.");
    }
  });

  // After Submit Hook
  eventEngine.on('SalesInvoice.after_submit', async (context) => {
    const { doc } = context;
    const posService = container.get('PosService');
    await posService.syncToLoyaltySystem(doc);
  });
}
```

### Hook Types
- **Sync Hooks** (`before_insert`, `before_update`): Used for validation or payload manipulation. If an error is thrown, the CRUD transaction is aborted.
- **Async Hooks** (`after_insert`, `after_update`, `submitted`): Used for notifications, external integrations, audit logs. Failures here do **not** abort the main transaction (non-blocking).

---

## 5. UI Plugin (Frontend Extension)

Frontend plugins work by injecting components into **Slots** (Extension Points) provided by the Next.js App.

Frontend plugin mechanics are more complex due to React's nature. The Framee solution:
- Plugins register components into a global Registry.
- Dynamic Form / Dynamic List reads the Registry: "Is there a custom component for this DocType?"
- If so, the custom UI is rendered in place of or alongside the standard UI.

*Note: Frontend Plugin Architecture implementation details will be developed in a later phase. The current focus is on backend hooks.*
