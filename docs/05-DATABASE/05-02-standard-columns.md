# 05-02 Standard Columns

## Purpose

Precisely defines all standard columns that must exist in every Framee table — including data types, constraints, default values, and usage rules. This document is the **column contract** that must never be violated by any engine.

---

## A. Standard Columns — `dt_*` Data Tables

All of these columns are automatically injected by the Database Engine when a DocType is activated.
**No DocField may have a `fieldname` that matches any of these standard columns.**

```sql
-- ─────────────────────────────────────────────────────────
-- IDENTITY
-- ─────────────────────────────────────────────────────────
id              VARCHAR(36)    NOT NULL,                  -- UUID v4, PK
tenant_id       VARCHAR(36)    NOT NULL,                  -- Row-level tenant isolation
name            VARCHAR(255)   NOT NULL DEFAULT '',       -- Human-readable record ID (series)

-- ─────────────────────────────────────────────────────────
-- LIFECYCLE STATUS  (replaces is_deleted, is_locked, docstatus)
-- ─────────────────────────────────────────────────────────
status          VARCHAR(20)    NOT NULL DEFAULT 'Draft',

-- ─────────────────────────────────────────────────────────
-- AUDIT TRAIL
-- ─────────────────────────────────────────────────────────
created_by      VARCHAR(36)    NULL,                      -- FK → sys_user.id (NULL = system)
updated_by      VARCHAR(36)    NULL,                      -- FK → sys_user.id
created_at      DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
updated_at      DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

-- ─────────────────────────────────────────────────────────
-- SOFT DELETE  (status='Deleted' + these columns)
-- ─────────────────────────────────────────────────────────
deleted_at      DATETIME       NULL DEFAULT NULL,
deleted_by      VARCHAR(36)    NULL DEFAULT NULL,         -- FK → sys_user.id
delete_reason   TEXT           NULL DEFAULT NULL,

-- ─────────────────────────────────────────────────────────
-- SUBMIT / CANCEL  (for is_submittable DocTypes)
-- ─────────────────────────────────────────────────────────
submitted_at    DATETIME       NULL DEFAULT NULL,
submitted_by    VARCHAR(36)    NULL DEFAULT NULL,         -- FK → sys_user.id
cancelled_at    DATETIME       NULL DEFAULT NULL,
cancelled_by    VARCHAR(36)    NULL DEFAULT NULL,
cancel_reason   TEXT           NULL DEFAULT NULL,

-- ─────────────────────────────────────────────────────────
-- AMENDMENT  (for amend flow)
-- ─────────────────────────────────────────────────────────
amended_from    VARCHAR(36)    NULL DEFAULT NULL,         -- FK → self (original doc id)

-- ─────────────────────────────────────────────────────────
-- VERSION
-- ─────────────────────────────────────────────────────────
version         INT UNSIGNED   NOT NULL DEFAULT 1,        -- increments on every save

-- ─────────────────────────────────────────────────────────
-- CONSTRAINTS
-- ─────────────────────────────────────────────────────────
PRIMARY KEY (id),
INDEX idx_{table}_tenant_status (tenant_id, status),
INDEX idx_{table}_tenant_created (tenant_id, created_at),
INDEX idx_{table}_name (tenant_id, name)
```

---

## B. Standard Columns — `sys_*` System Tables

System tables have a simpler set (no lifecycle metadata beyond status):

```sql
id          VARCHAR(36)   NOT NULL,
tenant_id   VARCHAR(36)   NOT NULL,
status      VARCHAR(20)   NOT NULL DEFAULT 'Active',
created_by  VARCHAR(36)   NULL,
updated_by  VARCHAR(36)   NULL,
created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
updated_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

PRIMARY KEY (id),
INDEX idx_{table}_tenant (tenant_id, status)
```

---

## C. Standard Columns — `dt_*_logs` Local Log Tables

```sql
id              VARCHAR(36)    NOT NULL,
tenant_id       VARCHAR(36)    NOT NULL,
doctype         VARCHAR(100)   NOT NULL,
doc_id          VARCHAR(36)    NOT NULL,                  -- FK → dt_{doctype}.id
doc_name        VARCHAR(255)   NULL,                      -- snapshot of record name
action          VARCHAR(30)    NOT NULL,
user_id         VARCHAR(36)    NULL,
user_name       VARCHAR(200)   NULL,
user_avatar     VARCHAR(255)   NULL,
comment         TEXT           NULL,                      -- for COMMENT actions
diff            JSON           NULL,                      -- brief change summary
change_summary  TEXT           NULL,
created_at      DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,

PRIMARY KEY (id),
INDEX idx_logs_doc     (tenant_id, doc_id, created_at),
INDEX idx_logs_doctype (tenant_id, doctype, created_at),
INDEX idx_logs_user    (tenant_id, user_id, created_at)
```

---

## D. Standard Columns — `dt_*_likes` Tables

```sql
id          VARCHAR(36)   NOT NULL,
tenant_id   VARCHAR(36)   NOT NULL,
doc_id      VARCHAR(36)   NOT NULL,
user_id     VARCHAR(36)   NOT NULL,
created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

PRIMARY KEY (id),
UNIQUE KEY uniq_like (tenant_id, doc_id, user_id)
```

---

## E. Column Reference Card

| Column | Present In | Type | Rule |
|--------|-----------|------|------|
| `id` | ALL | VARCHAR(36) | UUID v4, PK, NEVER auto-increment |
| `tenant_id` | ALL | VARCHAR(36) | NOT NULL, no default |
| `name` | dt_* | VARCHAR(255) | Human ID (series), not nullable |
| `status` | ALL | VARCHAR(20) | Lifecycle state, NOT NULL |
| `created_by` | ALL | VARCHAR(36) | NULL = system action |
| `updated_by` | ALL | VARCHAR(36) | NULL = system action |
| `created_at` | ALL | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| `updated_at` | ALL | DATETIME | ON UPDATE CURRENT_TIMESTAMP |
| `deleted_at` | dt_* | DATETIME | NULL = not deleted |
| `deleted_by` | dt_* | VARCHAR(36) | NULL = not deleted |
| `delete_reason` | dt_* | TEXT | NULL = not deleted |
| `submitted_at` | dt_* | DATETIME | NULL = not submitted |
| `submitted_by` | dt_* | VARCHAR(36) | NULL = not submitted |
| `cancelled_at` | dt_* | DATETIME | NULL = not cancelled |
| `cancelled_by` | dt_* | VARCHAR(36) | NULL = not cancelled |
| `cancel_reason` | dt_* | TEXT | NULL = not cancelled |
| `amended_from` | dt_* | VARCHAR(36) | NULL = original doc |
| `version` | dt_* | INT UNSIGNED | DEFAULT 1, increments on save |

---

## F. Lifecycle Status Values

### For `dt_*` tables (with `is_submittable = true`):

| Status | Meaning | Editable? | Next Possible Status |
|--------|---------|-----------|----------------------|
| `Draft` | Created, not yet submitted | ✅ Yes | Submitted, Deleted |
| `Submitted` | Submitted for approval / posting | ❌ No (amend only) | Locked, Cancelled |
| `Locked` | Fully locked (e.g., Posted Journal) | ❌ No (reversal only) | Cancelled |
| `Cancelled` | Cancelled with reason | ❌ No | Deleted |
| `Archived` | Archived, read-only | ❌ No | Deleted |
| `Deleted` | Soft-deleted | ❌ No | (restore to Draft) |

### For `dt_*` tables (with `is_submittable = false`, e.g., Customer):

| Status | Meaning |
|--------|---------|
| `Draft` | Just created, being edited |
| `Active` | Fully active record |
| `Archived` | Archived, read-only |
| `Deleted` | Soft-deleted |

### For `sys_*` tables:

| Status | Meaning |
|--------|---------|
| `Active` | Visible and functional |
| `Archived` | Deactivated, not visible |

---

## G. Rules

1. **`id` is always UUID v4** — generated in application, not in MySQL. `AUTO_INCREMENT` is forbidden.
2. **`tenant_id` is always NOT NULL** — every row belongs to a tenant. No global rows.
3. **`status` is the single source of truth** — no `is_deleted`, `is_locked`, `docstatus` columns ever.
4. **`created_at` and `updated_at` are auto-managed** — application code never sets them manually.
5. **`version` increments on every successful UPDATE** — enforced by CRUD Engine, not MySQL trigger.
6. **`amended_from` is NULL on original documents** — only set on amendment clones.
7. **System tables (`sys_*`) do not have lifecycle columns** — no `deleted_at`, `submitted_at`, etc.

---

## Notes

- These columns form the **column contract** that all engines depend on. Changing any column name, type, or constraint requires a framework-level migration and a major version bump.
- The `version` column is used by the Version Engine to detect concurrent edit conflicts (optimistic locking).
- `deleted_at` being NULL is the check for "not deleted" — not a `status != 'Deleted'` check alone. Both must be consistent.
