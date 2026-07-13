# 05-01 Naming Convention

## Purpose

Documents the naming conventions that apply to all database elements in Framee — tables, columns, indexes, and foreign keys. Consistency is critical here because `dt_*` tables are automatically generated from DocType metadata.

---

## Table Naming

| Table Group | Prefix | Example | Created By |
|-------------|--------|---------|------------|
| System/Core tables | `sys_` | `sys_doctype`, `sys_user`, `sys_audit_log` | Framework migration |
| DocType data tables | `dt_` | `dt_customer`, `dt_sales_invoice` | Auto-generated when DocType activated |
| DocType local log | `dt_` + `_logs` | `dt_customer_logs` | Auto-generated alongside data table |
| DocType like table | `dt_` + `_likes` | `dt_customer_likes` | Auto-generated alongside data table |
| Migration tracker | `sys_migrations` | — | Framework migration |

### Naming Rules
- **All lowercase** — no CamelCase, no PascalCase.
- **snake_case** — words separated by underscore.
- DocType name → snake_case: `SalesInvoice` → `dt_sales_invoice`.
- No special characters, no spaces, no hyphens.
- Maximum 64 characters (MySQL limit).

---

## Column Naming

| Column | Type | Rule |
|--------|------|------|
| Primary key | `id` | Always `id`, UUID (VARCHAR 36), never auto-increment |
| Tenant reference | `tenant_id` | Always present on every table |
| Status | `status` | VARCHAR(20), lifecycle state |
| Foreign keys | `{table_singular}_id` | e.g., `user_id`, `module_id`, `doctype_id` |
| Timestamps | `created_at`, `updated_at` | DATETIME, auto-managed |
| Soft lifecycle | `deleted_at`, `deleted_by` | DATETIME + VARCHAR(36), NULL when not deleted |
| Boolean flags | `is_{adjective}` | TINYINT(1), e.g., `is_active`, `is_system`, `is_submittable` |
| Content fields | descriptive noun | e.g., `customer_name`, `total_amount`, `description` |

### Column Rules
- Always **snake_case**.
- Foreign key columns always end with `_id`.
- Boolean columns always start with `is_`.
- Never use reserved MySQL words as column names (e.g., avoid `key`, `value`, `type`, `name` alone — prefix them: `field_type`, `record_name`).
- `name` column is allowed only for the `sys_*` naming/registry tables and DocType data tables (as the human-readable record ID).

---

## Standard Columns (Every `dt_*` Table)

These columns are auto-added to every DocType data table and must never be overridden by DocField definitions:

```sql
id              VARCHAR(36)   NOT NULL   -- UUID PK
tenant_id       VARCHAR(36)   NOT NULL   -- row-level tenant isolation
name            VARCHAR(255)  NOT NULL   -- human-readable record identifier (series: CUST-0001)
status          VARCHAR(20)   NOT NULL DEFAULT 'Draft'
created_by      VARCHAR(36)   NULL       -- FK → sys_user.id
updated_by      VARCHAR(36)   NULL       -- FK → sys_user.id
created_at      DATETIME      DEFAULT CURRENT_TIMESTAMP
updated_at      DATETIME      ON UPDATE CURRENT_TIMESTAMP
deleted_at      DATETIME      NULL
deleted_by      VARCHAR(36)   NULL
delete_reason   TEXT          NULL
amended_from    VARCHAR(36)   NULL       -- FK to original doc (for amend flow)
submitted_at    DATETIME      NULL
submitted_by    VARCHAR(36)   NULL
cancelled_at    DATETIME      NULL
cancelled_by    VARCHAR(36)   NULL
cancel_reason   TEXT          NULL
version         INT           DEFAULT 1  -- increments on every save
```

> ❌ **Retired columns that must NEVER appear:**
> - `is_deleted` — replaced by `status` + `deleted_at`
> - `is_locked` — replaced by `status`
> - `docstatus` — replaced by `status`

---

## Standard Columns (sys_* Tables)

System tables have a simpler column set (no lifecycle metadata):

```sql
id          VARCHAR(36)   NOT NULL   -- UUID PK
tenant_id   VARCHAR(36)   NOT NULL
status      VARCHAR(20)   NOT NULL DEFAULT 'Active'
created_by  VARCHAR(36)   NULL
updated_by  VARCHAR(36)   NULL
created_at  DATETIME      DEFAULT CURRENT_TIMESTAMP
updated_at  DATETIME      ON UPDATE CURRENT_TIMESTAMP
```

---

## Index Naming

Format: `idx_{table_short}_{columns}`

```sql
-- Primary key (auto-named by MySQL as PRIMARY)
PRIMARY KEY (id)

-- Unique constraints
UNIQUE KEY uniq_{table}_{column} (tenant_id, column_name)

-- Regular indexes
INDEX idx_{table}_{column}          (tenant_id, column_name)
INDEX idx_{table}_{col1}_{col2}     (tenant_id, col1, col2)

-- Full-text indexes
FULLTEXT idx_{table}_ft_{column}    (column_name)
```

Examples:
```sql
UNIQUE KEY uniq_doctype_name        (tenant_id, name)
INDEX idx_customer_status           (tenant_id, status)
INDEX idx_invoice_created           (tenant_id, created_at)
FULLTEXT idx_customer_ft_name       (customer_name)
```

---

## Foreign Key Naming

Format: `fk_{child_table}_{parent_table}`

```sql
CONSTRAINT fk_dt_customer_created_by
  FOREIGN KEY (created_by) REFERENCES sys_user(id)
  ON DELETE SET NULL ON UPDATE CASCADE;

CONSTRAINT fk_sys_docfield_doctype
  FOREIGN KEY (doctype_id) REFERENCES sys_doctype(id)
  ON DELETE CASCADE ON UPDATE CASCADE;
```

> **Note:** Foreign keys on `dt_*` tables to other `dt_*` tables are **not enforced at DB level** (to allow flexible DocType relationships). They are enforced at application level by the Link field type validation.

---

## Value Conventions

### UUID Generation
- All `id` columns use UUID v4 format: `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`.
- Generated in application layer (Node.js `crypto.randomUUID()`), not in MySQL.

### Record Name (Series)
- The `name` column stores the human-readable record identifier.
- Format defined per DocType via `name_series` metadata.
- Example: `CUST-0001`, `INV-2026-0042`, `PO-20260713-001`.
- If no series defined, `name` defaults to `id`.

### Status Values

| Context | Allowed Values |
|---------|---------------|
| Standard DocType | Draft, Submitted, Locked, Cancelled, Archived, Deleted |
| Simple DocType (no workflow) | Active, Archived, Deleted |
| System tables (`sys_*`) | Active, Archived |

---

## Reserved Field Names

These names are reserved and cannot be used as DocField `fieldname`:

```
id, name, tenant_id, status, created_by, updated_by, created_at, updated_at,
deleted_at, deleted_by, delete_reason, amended_from, submitted_at, submitted_by,
cancelled_at, cancelled_by, cancel_reason, version
```

---

## Notes

- These conventions apply to **all migrations** — both framework core and plugin-contributed.
- When a DocType name is changed (rename), the underlying table name does NOT change — only the metadata record is updated. This prevents breaking migrations.
- All decisions in this document are final for v1.x. Changes require a major version bump.
