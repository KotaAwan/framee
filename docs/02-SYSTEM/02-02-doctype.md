# 02-02 DocType

## Purpose

The DocType is the **fundamental data model unit** in Framee. It defines the schema, behavior, and characteristics of a business entity — such as Customer, Invoice, Employee, or Product. Every piece of business data in the system exists as an instance (record) of a DocType.

DocType is itself a DocType — it is managed using the same CRUD and metadata machinery as any other entity. This self-referential design means that the system is fully metadata-driven: defining a new business entity requires no code changes, only creating a new DocType record.

---

## Goals

1. Allow administrators to define new business data entities declaratively, without writing code.
2. Store DocType schema as metadata that drives all downstream behavior: API generation, form rendering, list rendering, validation, and permissions.
3. Serve as the canonical registry of all data entities in the system.
4. Support plugin-contributed DocTypes that integrate seamlessly with core-defined ones.
5. Enable DocType activation to automatically create the corresponding database table.

---

## Scope

### In Scope
- DocType definition management (name, label, module, settings)
- DocType-level configuration (submittable, tree structure, track changes, title field, search fields)
- Table creation/migration when a DocType is activated
- Listing all DocTypes for a tenant
- DocType-level metadata caching
- Plugin-contributed DocType registration

### Out of Scope
- Field definitions for a DocType (handled by DocField — see `02-03`)
- Workflow configuration for a DocType (handled by Workflow Engine — see `01-08`)
- Permission rules for a DocType (handled by Permission Engine — see `01-07`)
- Data records of a DocType (handled by CRUD Engine — see `01-03`)

---

## Functional Requirements

### FR-001 DocType Registration
- An administrator can create a DocType by specifying its name, label, module, and settings.
- DocType names are globally unique per tenant.
- DocType names become the routing key for API endpoints: `GET /api/v1/doc/{DocTypeName}`.

### FR-002 DocType Settings
- `is_submittable` — enables Submit/Cancel/Amend lifecycle operations.
- `is_tree` — enables hierarchical parent-child structure (lft/rgt fields auto-added for nested set).
- `is_single` — specifies that the DocType only ever has a single record (e.g. System Settings). Single DocTypes skip the List view and go straight to the Form view.
- `track_changes` — enables version snapshots on every save (handled by Version Engine).
- `title_field` — specifies which field is displayed as the record title.
- `search_fields` — comma-separated field names used in link search.
- `owner_permission` — owner of a record always has read/write regardless of role.
- `allow_cancel` — allows the document to be cancelled after submission.
- `allow_amend` — allows an amendment (clone) to be created from a cancelled/submitted document.
- `lock_on_submit` — when `true`, status becomes `Locked` upon submission and edits are blocked.
- `allowed_statuses` — JSON array of valid status values for this DocType (overrides default lifecycle if specified).

### FR-003 Database Table Generation
- When a DocType is activated (`is_active = 1`) for the first time, the system automatically creates a corresponding database table using the DocField definitions.
- Table name convention: `dt_{doctype_name_in_snake_case}` (e.g., DocType "Customer" → table `dt_customer`).
- The standard column contract (`id`, `tenant_id`, `status`, `created_by`, `updated_by`, `created_at`, `updated_at`, `deleted_at`, `deleted_by`, `amended_from`, etc.) is auto-added to every table.
- `is_deleted` and `is_locked` are **not** added. `status VARCHAR(20)` is the lifecycle column.

### FR-004 DocType Schema Update
- When DocFields are added or modified, the system detects the schema change and applies the necessary `ALTER TABLE` statements.
- Column drops are NOT automatic — they require explicit manual migration to prevent accidental data loss.

### FR-005 DocType Deactivation
- Deactivating a DocType hides it from navigation and makes its API return 404.
- The underlying data table and records are preserved.

### FR-006 System DocTypes
- System DocTypes (e.g., `Module`, `DocType`, `DocField`, `Role`, `User`) are marked `is_system = 1`.
- System DocTypes cannot be deleted but some settings can be modified by System Managers.

---

## Architecture

```
DocType Definition (sys_doctype + sys_docfield)
           │
           ├──► Metadata Engine (cached, served to all engines)
           ├──► API Engine (generates routes: GET/POST/PUT/DELETE /api/v1/doc/{name})
           ├──► CRUD Engine (validates, creates, reads, updates, deletes records)
           ├──► Permission Engine (reads DocType to build permission checks)
           ├──► Database Engine (creates/migrates the data table dt_{name})
           └──► Frontend (Dynamic Form, Dynamic List, Dynamic Layout)
```

---

## Database Design

### `sys_doctype` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | VARCHAR(36) | UUID PK |
| `tenant_id` | VARCHAR(36) | Tenant reference |
| `name` | VARCHAR(100) | Unique DocType name (PascalCase) |
| `label` | VARCHAR(150) | Display label |
| `module_id` | VARCHAR(36) | FK → sys_module.id |
| `description` | TEXT | AI-friendly description |
| `is_submittable` | TINYINT(1) | Supports submit/cancel/amend workflow |
| `is_tree` | TINYINT(1) | Hierarchical parent-child |
| `is_single` | TINYINT(1) | Only 1 record allowed (Settings) |
| `track_changes` | TINYINT(1) | Enable version snapshots per save |
| `title_field` | VARCHAR(100) | Field name for record title |
| `search_fields` | TEXT | Comma-separated searchable fields |
| `owner_permission` | TINYINT(1) | Owner has read/write regardless of role |
| `allow_cancel` | TINYINT(1) | Cancellation allowed after submit |
| `allow_amend` | TINYINT(1) | Amendment (clone) allowed |
| `lock_on_submit` | TINYINT(1) | Lock doc on submission |
| `allowed_statuses` | JSON | Valid status values for this DocType |
| `is_active` | TINYINT(1) | Module visible and accessible |
| `is_system` | TINYINT(1) | Cannot be deleted |
| `sort_order` | INT | Display order within module |
| `plugin_name` | VARCHAR(100) | Registering plugin (null for manual) |
| `table_created` | TINYINT(1) | Database table has been created |
| `created_by` | VARCHAR(36) | FK → sys_user.id |
| `updated_by` | VARCHAR(36) | FK → sys_user.id |
| `created_at` | DATETIME | Auto timestamp |
| `updated_at` | DATETIME | Auto timestamp |
| `status` | VARCHAR(20) | Lifecycle status (Active / Archived) |

### Indexes

```sql
UNIQUE INDEX idx_doctype_name (tenant_id, name)
INDEX idx_doctype_module (tenant_id, module_id)
INDEX idx_doctype_active (tenant_id, is_active, sort_order)
```

### Generated Table Convention

For a DocType named `PurchaseOrder`, activating it auto-creates **three tables**:

| Table | Purpose |
|-------|---------|
| `dt_purchase_order` | Main data table |
| `dt_purchase_order_logs` | Local activity log (Activity Timeline, Comments, Likes) |
| `dt_purchase_order_likes` | Per-user likes per record |

**`dt_purchase_order` standard columns:**
- `id`, `tenant_id`, `status` (default `'Draft'`)
- `created_by`, `updated_by`, `created_at`, `updated_at`
- `deleted_at`, `deleted_by`, `delete_reason`
- `amended_from`, `submitted_at`, `submitted_by`
- `cancelled_at`, `cancelled_by`, `cancel_reason`
- `workflow_state VARCHAR(100)` — auto-added if `is_submittable = 1`
- `parent`, `parent_field` — auto-added if `is_tree = 1`
- Each DocField generates a corresponding column with appropriate MySQL type

> `docstatus` and `is_deleted` columns are **not** generated. Use `status` instead.
>
> The `_logs` and `_likes` companion tables are always created — even if `track_changes = false`. The `track_changes` flag only controls whether field-level diffs are recorded in `sys_audit_log`.


### DocField to MySQL Type Mapping

| DocField Type | MySQL Column Type |
|---------------|-------------------|
| Data | VARCHAR(255) |
| Int | INT |
| Float | DECIMAL(18, 6) |
| Currency | DECIMAL(18, 2) |
| Date | DATE |
| Datetime | DATETIME |
| Time | TIME |
| Text | TEXT |
| Long Text | LONGTEXT |
| Select | VARCHAR(100) |
| Link | VARCHAR(36) |
| Check | TINYINT(1) |
| Attach | TEXT |
| HTML | LONGTEXT |
| Table | — (child table, not a column) |

---

## API Design

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/doc/DocType` | List all DocTypes for tenant |
| `POST` | `/api/v1/doc/DocType` | Create a new DocType |
| `GET` | `/api/v1/doc/DocType/:id` | Get DocType details |
| `PUT` | `/api/v1/doc/DocType/:id` | Update DocType settings |
| `DELETE` | `/api/v1/doc/DocType/:id` | Soft delete DocType |
| `POST` | `/api/v1/doc/DocType/:id/activate` | Activate DocType and create DB table |
| `POST` | `/api/v1/doc/DocType/:id/deactivate` | Deactivate DocType |

#### Example — `POST /api/v1/doc/DocType` (Create)

```json
{
  "name": "Supplier",
  "label": "Supplier",
  "module_id": "procurement-module-uuid",
  "description": "Represents a business supplier or vendor entity.",
  "is_submittable": false,
  "track_changes": true,
  "title_field": "supplier_name",
  "search_fields": "supplier_name,phone"
}
```

---

## UI Behaviour

### DocType List View
- Shows all DocTypes grouped by Module.
- Columns: Name, Label, Module, Is Submittable, Is Active, Action buttons.
- Filter by module, active status.

### DocType Form View
- **General section**: Name, Label, Module, Description.
- **Settings section**: Is Submittable, Is Tree, Track Changes, Title Field, Search Fields, Owner Permission.
- **Fields tab**: Child table (DocField list) for managing fields — see `02-03`.
- **Permissions tab**: Permission rules for this DocType — see `01-07`.

### Activation Flow
- When a user clicks "Activate", a confirmation modal explains that this will create a database table.
- Progress indicator shows during table creation.
- After activation, the DocType's API endpoints are immediately accessible.

---

## Configuration

| Config Key | Default | Description |
|------------|---------|-------------|
| `DOCTYPE_TABLE_PREFIX` | `dt_` | Prefix for auto-generated data tables |
| `DOCTYPE_ALLOW_DELETE` | `false` | Allow deleting DocTypes with existing data |
| `DOCTYPE_SCHEMA_AUTO_MIGRATE` | `true` | Auto-apply schema changes on DocField save |

---

## Validation Rules

- `name` must be unique per tenant. PascalCase is recommended but not enforced.
- `name` must match `^[A-Za-z][A-Za-z0-9 ]*$` — alphanumeric with spaces allowed (spaces replaced with underscores in table name).
- `name` must not conflict with reserved system names (`Module`, `DocType`, `DocField`, `User`, `Role`, `Menu`).
- `module_id` must reference an existing, active module.
- `title_field` must reference a valid fieldname in the DocType's field list.
- System DocTypes (`is_system = 1`) cannot be deleted.
- A DocType with existing data records cannot be deleted (only deactivated).

---

## Security

- Creating and modifying DocTypes requires System Manager or Module Manager role.
- Deactivating a DocType hides it from all non-admin users — API returns 404.
- The activation endpoint (table creation) requires System Manager role due to DDL execution.
- DocType names are sanitized before use as table names to prevent SQL injection via DDL.

---

## Events

| Event | Trigger |
|-------|---------|
| `DocType.after_insert` | New DocType created |
| `DocType.after_update` | DocType settings modified |
| `DocType.after_delete` | DocType soft deleted |
| `doctype.activated` | DocType activated and table created |
| `doctype.deactivated` | DocType deactivated |
| `doctype.schema_migrated` | DB table schema updated for DocType |

### Listened Events

| Event | Action |
|-------|--------|
| `DocType.after_insert` | Invalidate module DocType list cache |
| `DocType.after_update` | Invalidate metadata cache for this DocType |
| `doctype.activated` | Register API routes for new DocType |

---

## Performance

- DocType metadata is cached in Redis as part of the Metadata Engine warm-up.
- DocType list per module is cached separately to support fast sidebar navigation rendering.
- Table creation (DDL) is a synchronous operation with a progress feedback mechanism to avoid frontend timeouts.
- Schema migration (adding columns) uses `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` to be idempotent.

---

## Future Improvements

- **DocType Cloning** — Create a new DocType based on an existing one's field configuration.
- **DocType Import/Export** — Export a DocType definition as JSON for sharing between tenants or environments.
- **DocType Versioning** — Track schema change history per DocType.
- **Virtual DocTypes** — DocTypes that don't have a backing database table but serve computed/aggregated data.
- **DocType-Level Computed Fields** — Fields auto-calculated from other fields using metadata-defined formulas.

---

## Acceptance Criteria

- [ ] Creating a DocType with a unique name succeeds and the record appears in the DocType list.
- [ ] Creating a DocType with a duplicate name returns a validation error.
- [ ] Activating a DocType creates the `dt_{name}` table in MySQL with standard columns.
- [ ] The activated DocType's CRUD API (`/api/v1/doc/{name}`) is immediately accessible.
- [ ] Adding a DocField after activation triggers `ALTER TABLE` to add the new column.
- [ ] Deactivating a DocType makes its API return 404.
- [ ] System DocTypes cannot be deleted.
- [ ] A DocType with `is_submittable = true` has a `docstatus` and `workflow_state` column in its table.
- [ ] Metadata Engine cache is invalidated immediately after DocType update.

---

## Notes

- DocType names use PascalCase by convention (e.g., `PurchaseOrder`, `CustomerAddress`). This convention makes them readable as entity names and allows the system to derive the snake_case table name automatically.
- DocType is both a framework concept (the schema) and a data record (an instance in `sys_doctype`). This dual nature is what makes the system fully metadata-driven.
- Developers must not manually alter `dt_*` tables outside of the migration system. All schema changes must go through the DocField management interface to keep metadata and schema in sync.
