# 05-06 Audit Tables

## Purpose

Documents the table schema for the Audit Trail and Activity Timeline features (Two-Tier Logging Architecture).

---

## 1. Overview (Reminder)

Framee separates logs into two tiers:
1. **Global Log (`sys_audit_log`)**: Immutable, for legal compliance, contains all changes in full detail (diff), accessible by admin only.
2. **Local Log (`dt_*_logs`)**: Dynamically created per DocType, for the UI Activity Timeline, contains change summaries and social interactions (Comments and Likes as events).
3. **Likes (`dt_*_likes`)**: Tracks the current "liked-by" state per user per document (for toggling ❤ and counting).

> **Activity Timeline = single query from `dt_*_logs` only.**
> All events (system events + COMMENT + LIKE/UNLIKE) are recorded as rows in `dt_*_logs`.
> `dt_*_likes` is a separate lookup table used only to check: "Has this user already liked this document?" and "What is the total like count?"

---

## 2. Table: `sys_audit_log` (Global Immutable Log)

```sql
CREATE TABLE sys_audit_log (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  
  doctype VARCHAR(100) NOT NULL,
  doc_id VARCHAR(36) NOT NULL,
  doc_name VARCHAR(255) NULL,
  
  action VARCHAR(30) NOT NULL,          -- CREATE, UPDATE, DELETE, LOCK, LOGIN, etc.
  
  user_id VARCHAR(36) NULL,             -- NULL if System action
  user_name VARCHAR(200) NULL,
  
  ip_address VARCHAR(45) NULL,          -- IPv4 or IPv6
  user_agent TEXT NULL,
  
  diff JSON NULL,                       -- Before/After state for changed fields
  change_summary TEXT NULL,             -- Human-readable description (e.g., "Updated Total")
  metadata JSON NULL,                   -- Additional context (reason, workflow id, etc.)
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes for admin queries
  INDEX idx_audit_doc (tenant_id, doctype, doc_id, created_at),
  INDEX idx_audit_user (tenant_id, user_id, created_at),
  INDEX idx_audit_action (tenant_id, action, created_at)
  
  -- IMPORTANT:
  -- No updated_at, no status, no delete columns.
  -- REVOKE UPDATE, DELETE must be set at the Database User level.
);
```

---

## 3. Dynamic Local Log Tables: `dt_{doctype}_logs`

Every time a DocType is activated, alongside the creation of `dt_{doctype}`, the Database Engine also executes the creation of this table. This table is the **single source of truth** for the Activity Timeline.

Example for DocType `Customer`:

```sql
CREATE TABLE dt_customer_logs (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  
  doctype VARCHAR(100) NOT NULL,        -- Always 'Customer'
  doc_id VARCHAR(36) NOT NULL,          -- Soft FK to dt_customer.id
  doc_name VARCHAR(255) NULL,
  
  action VARCHAR(30) NOT NULL,
  -- System events: CREATE, UPDATE, DELETE, SUBMIT, CANCEL, LOCK, UNLOCK, AMEND, ARCHIVE
  -- Social events: COMMENT, LIKE, UNLIKE
  
  user_id VARCHAR(36) NULL,
  user_name VARCHAR(200) NULL,
  user_avatar VARCHAR(255) NULL,        -- Snapshotted so timeline stays intact if avatar changes
  
  comment TEXT NULL,                    -- Only populated for action = COMMENT
  diff JSON NULL,                       -- Brief field list (no before/after values)
  change_summary TEXT NULL,             -- Human-readable single-line description
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_doclogs_doc (tenant_id, doc_id, created_at),
  INDEX idx_doclogs_doctype (tenant_id, doctype, created_at)
);
```

### Comment Modification Rules
- A user can edit their own comment within a configurable window (`COMMENT_EDIT_WINDOW_MINUTES`, default: 15 minutes).
- Because this table is intended for the UI Timeline, it is not subject to the same strict immutability as `sys_audit_log`.

---

## 4. Dynamic Like Tables: `dt_{doctype}_likes`

Stores the "liked-by" state — which users have liked which document. Created dynamically alongside the DocType.

This table is **not** used for the Activity Timeline display. It is used only for:
- Checking if the current user has liked a document (`SELECT WHERE doc_id = X AND user_id = Y`).
- Counting total likes (`SELECT COUNT(*)`).
- Preventing duplicate likes (`UNIQUE KEY`).

Example for DocType `Customer`:

```sql
CREATE TABLE dt_customer_likes (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  
  doc_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  -- One user can only like once
  UNIQUE KEY uniq_like (tenant_id, doc_id, user_id)
);
```

### Like Toggle Flow
When a user clicks ❤ on a document:
1. Check `dt_*_likes` for `(doc_id, user_id)`.
2. **Not found (Like)**: INSERT into `dt_*_likes` + INSERT `action = 'LIKE'` into `dt_*_logs`.
3. **Found (Unlike)**: DELETE from `dt_*_likes` + INSERT `action = 'UNLIKE'` into `dt_*_logs`.

The Activity Timeline displays both LIKE and UNLIKE events from `dt_*_logs` in chronological order.
