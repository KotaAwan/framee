# 05-02 Standard Columns

## Purpose

Precisely defines all standard columns that must exist in every Framee table — including data types, constraints, default values, and usage rules. This document is the **column contract** that must never be violated by any engine.

---

## A. Standard Columns — `sys_*` System Tables

These columns are standardized for main system tables.
No audit trail timestamps (`created_at`, `updated_at`, etc.) exist in the main tables. They are tracked entirely via `_logs` and `_version` tables.

```sql
-- ─────────────────────────────────────────────────────────
-- IDENTITY
-- ─────────────────────────────────────────────────────────
id              INT UNSIGNED   NOT NULL AUTO_INCREMENT,   -- PK
code            VARCHAR(50)    NULL UNIQUE,               -- Series Format, User visible
name            VARCHAR(150)   NOT NULL,                  -- Human-readable record name/title

-- ─────────────────────────────────────────────────────────
-- LIFECYCLE STATUS
-- ─────────────────────────────────────────────────────────
status          VARCHAR(100)   NULL,                      -- References sys_workflow_state.name
is_deleted      BOOLEAN        NOT NULL DEFAULT 0,        -- 0: No, 1: Yes (Soft Delete)

-- ─────────────────────────────────────────────────────────
-- CONSTRAINTS
-- ─────────────────────────────────────────────────────────
PRIMARY KEY (id)
```

---

## B. Standard Columns — `<table_name>_logs` Local Log Tables

Every table (except some core meta tables) has an auto-generated `_logs` table tracking creation, updates, deletes, and social events (comments, likes).

```sql
id              INT UNSIGNED   NOT NULL AUTO_INCREMENT,
doc_id          INT UNSIGNED   NOT NULL,                  -- FK → main_table.id
status          VARCHAR(100)   NULL,                      -- E.g. "Created", "Updated", "Deleted", "Liked", "Commented" or Workflow Action name
content         TEXT           NULL,                      -- Stores the document's `name` or the exact `comment` content
created_by      INT UNSIGNED   NULL,                      -- FK → sys_user.id
created_at      DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,

PRIMARY KEY (id)
```

---

## C. Standard Columns — `<table_name>_version` Local Version Tables

Every table (except some core meta tables) has an auto-generated `_version` table tracking historical data snapshots BEFORE an update.

```sql
id              INT UNSIGNED   NOT NULL AUTO_INCREMENT,
doc_id          INT UNSIGNED   NOT NULL,                  -- (old_id) FK → main_table.id
-- [... Exact copy of all fields from main table here ...]
backup_by       INT UNSIGNED   NULL,                      -- FK → sys_user.id
backup_at       DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,

PRIMARY KEY (id)
```

---

## D. Column Reference Card

| Column | Present In | Type | Rule |
|--------|-----------|------|------|
| `id` | ALL Main Tables | INT UNSIGNED AUTO_INCREMENT | PK |
| `code` | Most Main Tables | VARCHAR(50) UNIQUE | Auto-generated Series Format ID (e.g. USER-2607-0001) |
| `name` | Most Main Tables | VARCHAR(150) | Human-readable Name/Title |
| `status` | ALL Main Tables | VARCHAR(100) | Lifecycle state, referencing `sys_workflow_state.name` |
| `is_deleted` | ALL Main Tables | BOOLEAN | 0 = Active, 1 = Soft Deleted |

---

## E. Rules

1. **`id` is always INT UNSIGNED AUTO_INCREMENT** — MySQL manages the primary key. UUIDs are completely removed from the new structure for efficiency.
2. **`code` is the user-facing identifier** — When presenting relations in the UI, `code` - `name` is shown.
3. **`status` and `is_deleted` are the only lifecycle columns** — No `deleted_at`, `submitted_at`, `created_at` in the main tables.
4. **All History is delegated to Local Tables** — Instead of a monolithic global audit table, each table relies on its specific `_logs` table (for event history) and `_version` table (for data snapshots).
5. **String-based References** — Key relational meta-references like `doctype` and workflow states/actions now use `VARCHAR(100)` storing strings (table_names and action names) rather than integer IDs, simplifying querying and readability.
