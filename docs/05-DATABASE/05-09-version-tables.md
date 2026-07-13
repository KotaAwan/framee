# 05-09 Version Tables

## Purpose

Documents the table schema supporting the Version History feature in Framee (Version Engine, `01-11-version-engine.md`). With this table, the system can store document snapshots at every point in time and allow restoration (restore) to a previous version.

---

## 1. Overview

Version History differs from the Audit Log:

| | Audit Log | Version History |
|--|-----------|-----------------|
| **What is stored?** | Who changed what (diff) | Full document snapshot |
| **Purpose** | Compliance & Forensics | Rollback & Compare |
| **Can restore?** | No | Yes |
| **Table** | `sys_audit_log` | `sys_doc_version` |
| **When created?** | Every change | Every SAVE (if track_changes = true) |

---

## 2. Table: `sys_doc_version`

Stores a complete snapshot of a document after every successful SAVE operation.

```sql
CREATE TABLE sys_doc_version (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  
  doctype VARCHAR(100) NOT NULL,
  doc_id VARCHAR(36) NOT NULL,          -- Soft FK to dt_{doctype}.id
  doc_name VARCHAR(255) NULL,           -- Snapshot of document name
  
  version_number INT NOT NULL,          -- Same as the 'version' column value in dt_{doctype}
  
  data JSON NOT NULL,                   -- COMPLETE snapshot of the entire document (all fields)
  
  -- Context of who created this version
  created_by VARCHAR(36) NULL,          -- FK to sys_user.id
  created_by_name VARCHAR(200) NULL,    -- Snapshot of user name
  
  -- Change summary from the previous version
  change_summary TEXT NULL,             -- e.g., "Updated 3 fields: customer_name, phone, status"
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes
  UNIQUE KEY uniq_version (tenant_id, doctype, doc_id, version_number),
  INDEX idx_version_doc (tenant_id, doctype, doc_id, created_at)
  
  -- Note: No updated_at because version records are immutable
);
```

---

## 3. When is a Snapshot Created?

The Version Engine (as an event subscriber) creates a snapshot on these events:
- `{doctype}.after_insert` → version_number = 1
- `{doctype}.after_update` → version_number = (previous version + 1)
- `{doctype}.submitted` → snapshot at submit
- `{doctype}.cancelled` → snapshot at cancel
- `{doctype}.amended` → snapshot from the amendment document

Snapshots are **not** created for:
- DocTypes with `track_changes = false`.
- Operations that only change status without content data changes (optional, configurable).

---

## 4. `data` JSON Structure (Snapshot)

The content of the `data` column is the complete document object (all fields in `dt_*` plus all custom DocFields):

```json
{
  "id": "123e4567-...",
  "name": "CUST-0001",
  "status": "Draft",
  "customer_name": "PT. Maju Jaya",
  "customer_type": "Company",
  "phone": "+62812345678",
  "credit_limit": 50000000,
  "created_at": "2026-07-13T03:00:00Z",
  "version": 2
}
```

**Fields EXCLUDED from snapshots:**
- `password_hash` (if present in a document)
- Fields with `fieldtype = 'Password'`

---

## 5. Restore Flow

When an admin or user wants to restore an old version:
1. Frontend calls `GET /api/v1/doc/{DocType}/{id}/versions` to get the list of versions.
2. User selects the version to restore.
3. Frontend calls `POST /api/v1/doc/{DocType}/{id}/restore` with `{ version_number: 3 }`.
4. Version Engine:
   a. Reads `data` from `sys_doc_version` for the requested version_number.
   b. Calls `CRUDEngine.update()` with data from the snapshot, appending `change_summary: "Restored to version 3"`.
   c. This creates a new version (e.g., version 5) whose content is the same as version 3, rather than overwriting existing versions.

> **Key Principle:** Restore never deletes or overwrites existing versions. A Restore always creates a new version entry.

---

## 6. Retention & Storage

JSON snapshots can be quite large for documents with many fields. Recommendations:
- For high-volume DocTypes (Stock Ledger, Job Log), consider disabling `track_changes`.
- Implement a cleanup job that periodically compresses or deletes old snapshots (e.g., keep only the last 50 versions per document, or only versions within the last year).
- Configuration: `VERSION_MAX_KEEP = 50` (0 = keep all).
