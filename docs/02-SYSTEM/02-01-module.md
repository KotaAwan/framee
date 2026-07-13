# 02-01 Module

## Purpose

The Module is the **top-level organizational unit** in Framee. It groups related DocTypes, menus, and configurations under a named business domain — such as "Accounting", "Human Resources", "Inventory", or "CRM".

Every DocType in the system belongs to exactly one Module. Modules are the highest-level navigation and organizational concept that end users and developers interact with. They provide the structure that makes a large ERP system navigable and comprehensible.

---

## Goals

1. Provide a clear organizational structure that groups related DocTypes into named business domains.
2. Allow modules to be enabled or disabled per tenant without affecting other modules.
3. Enable plugins to register their own modules without modifying core code.
4. Provide a module-level entry point for navigation, generating top-level menu groups.
5. Support multi-tenant module configuration — each tenant can activate different sets of modules.

---

## Scope

### In Scope
- Module registration and management (CRUD)
- Module-level enable/disable per tenant
- Module-to-DocType association
- Module-based navigation (top-level sidebar sections)
- Plugin-contributed module registration
- Module icon, color, and display ordering configuration

### Out of Scope
- DocType-level configuration (handled by DocType — see `02-02`)
- Menu item configuration (handled by Menu — see `02-04`)
- Permission control per module (handled by Permission Engine — see `01-07`)

---

## Functional Requirements

### FR-001 Module Registration
- Each module must have a unique `name` per tenant.
- Modules can be created by administrators via the admin UI.
- Plugins can register modules programmatically via the plugin manifest.

### FR-002 Module Activation
- Each module has an `is_active` flag per tenant.
- Inactive modules are hidden from navigation and their DocTypes are inaccessible via the API (return 404).
- System core modules cannot be deactivated.

### FR-003 DocType Association
- Each DocType references a `module_id` (FK → sys_module.id).
- When a module is deactivated, all its DocTypes are effectively deactivated.

### FR-004 Navigation Generation
- Active modules appear as top-level sections in the sidebar navigation.
- Module order in the sidebar is controlled by `sort_order`.

### FR-005 Plugin Modules
- Plugins declare their module in `plugin.manifest.json`.
- The Plugin Loader creates or updates the module record on plugin registration.

---

## Architecture

```
Module
  ├── DocType A         ← sys_doctype.module_id = module.id
  ├── DocType B
  ├── DocType C
  └── Menu Items        ← sys_menu.module_id = module.id
```

Modules are purely organizational — they have no execution logic. They are metadata containers.

---

## Database Design

### `sys_module` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | VARCHAR(36) | UUID PK |
| `tenant_id` | VARCHAR(36) | Tenant reference |
| `name` | VARCHAR(100) | Unique module name per tenant (snake_case) |
| `label` | VARCHAR(150) | Display label |
| `description` | TEXT | Module description (AI-friendly) |
| `icon` | VARCHAR(100) | Icon name or SVG identifier |
| `color` | VARCHAR(50) | Hex color for module branding |
| `sort_order` | INT | Display order in navigation |
| `is_active` | TINYINT(1) | Module enabled/disabled |
| `is_system` | TINYINT(1) | Core system module (cannot be deleted) |
| `plugin_name` | VARCHAR(100) | Registering plugin name (null for manual) |
| `created_by` | VARCHAR(36) | FK → sys_user.id |
| `updated_by` | VARCHAR(36) | FK → sys_user.id |
| `created_at` | DATETIME | Auto timestamp |
| `updated_at` | DATETIME | Auto timestamp |
| `is_deleted` | TINYINT(1) | Soft delete |

### Indexes

```sql
UNIQUE INDEX idx_module_name (tenant_id, name)
INDEX idx_module_tenant_active (tenant_id, is_active, sort_order)
INDEX idx_module_plugin (plugin_name)
```

### Relationships

```
sys_module.id ← sys_doctype.module_id (one-to-many)
sys_module.id ← sys_menu.module_id    (one-to-many)
```

---

## API Design

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/doc/Module` | List all modules for tenant |
| `POST` | `/api/v1/doc/Module` | Create a new module |
| `GET` | `/api/v1/doc/Module/:id` | Get module details |
| `PUT` | `/api/v1/doc/Module/:id` | Update module |
| `DELETE` | `/api/v1/doc/Module/:id` | Soft delete module |
| `GET` | `/api/v1/meta/modules` | List active modules (public metadata) |

#### Example — `GET /api/v1/meta/modules`

```json
{
  "success": true,
  "data": [
    {
      "name": "accounting",
      "label": "Accounting",
      "icon": "calculator",
      "color": "#4A90D9",
      "sort_order": 1
    },
    {
      "name": "hr",
      "label": "Human Resources",
      "icon": "people",
      "color": "#7B61FF",
      "sort_order": 2
    }
  ]
}
```

---

## UI Behaviour

- Modules appear as top-level navigation sections in the sidebar.
- Each module section can be expanded/collapsed to reveal its DocType links.
- Inactive modules are hidden from all users.
- System Manager can activate/deactivate modules from the Module list view.
- Module icon and color visually distinguish sections for quick navigation.

---

## Configuration

| Config Key | Default | Description |
|------------|---------|-------------|
| `SYSTEM_MODULES` | `['core', 'system']` | Core module names that cannot be deactivated |

---

## Validation Rules

- `name` must be unique per tenant. Duplicates are rejected.
- `name` must match `^[a-z][a-z0-9_]*$` — lowercase, underscore-separated.
- Core system modules (`is_system = 1`) cannot be deleted or deactivated.
- A module cannot be deleted if it has active DocTypes (must deactivate DocTypes first).

---

## Security

- Creating and deleting modules requires System Manager or Module Manager role.
- Module list (navigation data) is served only to authenticated users.
- Inactive module DocTypes return 404 to non-admin roles — the module's existence is not disclosed.

---

## Events

| Event | Trigger |
|-------|---------|
| `module.activated` | Module is enabled |
| `module.deactivated` | Module is disabled |
| `module.after_insert` | New module created |
| `module.after_delete` | Module soft deleted |

---

## Performance

- Active module list is cached in Redis as part of the metadata warm-up.
- Cache key: `framee:meta:{tenant_id}:modules`.
- Invalidated when any module's `is_active` or `sort_order` changes.

---

## Future Improvements

- **Module Marketplace** — Browse and install curated modules/plugins from a central registry.
- **Module Dependencies** — Declare that Module A requires Module B to be active.
- **Per-User Module Visibility** — Allow specific roles to see only a subset of active modules.
- **Module Color Themes** — Full color theme support per module for distinct visual branding.

---

## Acceptance Criteria

- [ ] Creating a module with a unique name succeeds and it appears in the module list.
- [ ] Creating a module with a duplicate name returns a validation error.
- [ ] Deactivating a module hides it from sidebar navigation.
- [ ] Attempting to access a DocType in a deactivated module returns 404.
- [ ] Core system modules cannot be deleted or deactivated.
- [ ] A plugin's declared module appears in the module list after plugin registration.
- [ ] Module sort_order correctly orders modules in the sidebar.

---

## Notes

- Modules are the primary organizational concept visible to end users. A well-designed module structure makes the ERP system easy to navigate.
- Module names should correspond to business domains (e.g., `hr`, `accounting`, `inventory`), not technical names.
- When a plugin is uninstalled, its module should be deactivated (not deleted) to preserve historical data references.
