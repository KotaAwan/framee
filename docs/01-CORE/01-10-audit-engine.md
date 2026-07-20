# 01-10 Audit Engine

## Purpose

The Audit Engine is Framee's **immutable record of who did what, when, and why**. It automatically captures every meaningful action performed on every document and stores them in a tamper-evident, append-only audit log.

It exists because ERP systems handle consequential business data. When an auditor asks "who changed this invoice amount and when?", the Audit Engine provides the answer — definitively.

---

## Two-Tier Log Architecture

Framee uses **two separate logging systems** that serve different purposes:

```
┌──────────────────────────────────────────────────────────────────────┐
│              Framee Two-Tier Logging                                  │
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐   │
│  │  LOCAL LOG — <doctype>_logs                                   │   │
│  │  One table per DocType (e.g., dt_customer_logs)               │   │
│  │  Purpose: Activity Timeline, Comments, Likes                  │   │
│  │  Visible in: pageIndex (below table), modalView timeline      │   │
│  │  Contents: Create / Update / Delete / Lock / Unlock /         │   │
│  │            Comment / Like / Unlike + human summary            │   │
│  └───────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐   │
│  │  GLOBAL LOG — sys_audit_log                                   │   │
│  │  One global table for all DocTypes                            │   │
│  │  Purpose: Compliance, Forensics, Regulatory Audit             │   │
│  │  Visible in: Admin Audit Log page (System Manager only)       │   │
│  │  Contents: All of the above + field-level DIFF (before/after) │   │
│  │            + IP, user agent, metadata                         │   │
│  └───────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
```

| Aspect | Local Log (`<doctype>_logs`) | Global Log (`sys_audit_log`) |
|--------|------------------------------|------------------------------|
| Storage | Per-DocType table | Single global table |
| Purpose | Activity timeline, social (like/comment) | Compliance, forensics |
| Visibility | End users (in list + modal) | System Manager / Auditor only |
| Contains diff | Summary only | Full field-level before/after diff |
| Contains IP/agent | No | Yes |
| Comments/Likes | Yes | No (separate concern) |
| Immutable | No (comments can be edited) | Yes (no UPDATE/DELETE) |
| Retention | Configurable | Indefinite (regulatory) |

---

## Goals

1. Automatically record every write operation on every document without developers calling an audit function explicitly.
2. Write to **both** Local Log and Global Log simultaneously (async, non-blocking).
3. Local Log: lightweight, human-readable, includes social actions (like/comment).
4. Global Log: immutable, complete, with full field-level diffs for compliance.
5. Make Global Log records tamper-evident — no update or delete permitted.
6. Integrate with the Event Engine — audit recording triggered by document events.

---

## Scope

### In Scope
- Async capture of all CRUD + lifecycle events → writes to both Local and Global log
- Field-level before/after diff (Global Log only)
- Comment write (Local Log via `POST /api/v1/doc/{DocType}/{id}/comment`)
- Like/Unlike write (Local Log via `POST /api/v1/doc/{DocType}/{id}/like`)
- Login/logout events (Global Log only)
- Permission/role change events (Global Log only)
- Audit query API (per document, per user, per date range)
- Admin Audit Log viewer (Global Log)
- Activity Timeline in Dynamic List and ViewModal (Local Log)

### Out of Scope
- Version history and document restore (handled by Version Engine — `01-11`)
- Application error logs (Winston logger)
- Infrastructure logs (hosting environment)

---

## Functional Requirements

### FR-001 Two-Tier Logging — Actual Implementation

> **Important: The actual implementation differs from the original design in the following way:**

| Log | Written by | When |
|-----|-----------|------|
| **Local Log** (`{table}_logs`) | **CRUD Engine** (synchronous, inside the DB transaction) | On insert, workflow transition |
| **Global Log** (`sys_audit_log`) | **Audit Engine** (async event subscriber) | On all write events |

- The CRUD Engine writes directly to `{table}_logs` inside the same transaction as the record insert. If the transaction rolls back, the log entry is also rolled back.
- The Audit Engine subscribes to after-event emissions for the global `sys_audit_log` only.
- No application code calls `auditEngine.log()` directly — the CRUD Engine handles local logs, the Audit Engine handles global logs.
- Exception: social events (COMMENT, LIKE, UNLIKE) write to Local Log only.
- Exception: LOGIN/LOGOUT, PERMISSION_CHANGED write to Global Log only.

### FR-002 Captured Events

| Event | Local Log | Global Log | Notes |
|-------|-----------|------------|-------|
| `{doctype}.after_insert` | ✅ CREATE | ✅ CREATE | |
| `{doctype}.after_update` | ✅ UPDATE (summary) | ✅ UPDATE (full diff) | |
| `{doctype}.submitted` | ✅ SUBMIT | ✅ SUBMIT | |
| `{doctype}.cancelled` | ✅ CANCEL | ✅ CANCEL | |
| `{doctype}.amended` | ✅ AMEND | ✅ AMEND | |
| `{doctype}.archived` | ✅ ARCHIVE | ✅ ARCHIVE | |
| `{doctype}.deleted` | ✅ DELETE | ✅ DELETE | |
| `{doctype}.locked` | ✅ LOCK | ✅ LOCK | |
| `{doctype}.unlocked` | ✅ UNLOCK | ✅ UNLOCK | |
| `{doctype}.comment` | ✅ COMMENT | ❌ | Social only |
| `{doctype}.liked` | ✅ LIKE | ❌ | Social only |
| `{doctype}.unliked` | ✅ UNLIKE | ❌ | Social only |
| `user.login` | ❌ | ✅ LOGIN | System event |
| `user.logout` | ❌ | ✅ LOGOUT | System event |
| `user.login_failed` | ❌ | ✅ LOGIN_FAILED | Security |
| `user.role_assigned` | ❌ | ✅ ROLE_ASSIGNED | System event |
| `user.role_removed` | ❌ | ✅ ROLE_REMOVED | System event |
| `role.permission_changed` | ❌ | ✅ PERMISSION_CHANGED | System event |
| `{doctype}.workflow.{action}` | ✅ WORKFLOW | ✅ WORKFLOW_TRANSITION | |

### FR-003 Field-Level Diff (Global Log only)
- For `UPDATE` events, Global Log records a `diff` — field names with before/after values.
- Only changed fields are included (not the full record).
- Sensitive fields (`Password`) are excluded from the diff.
- Local Log receives only a human-readable `change_summary` string.

### FR-004 Comment System (Local Log)
- `POST /api/v1/doc/{DocType}/{id}/comment` with `{ "text": "..." }`.
- Creates a `COMMENT` entry in `<doctype>_logs`.
- Returns the comment record.
- Increments the comment count aggregate.
- Comments are NOT immutable — the author can edit or delete their own comment within a configurable window (`COMMENT_EDIT_WINDOW_MINUTES`, default: 15).

### FR-005 Like / Unlike System (Local Log)
- `POST /api/v1/doc/{DocType}/{id}/like` — toggles like for current user.
- **Both Like and Unlike are tracked** as separate log entries in `{table}_logs`.
  - `LIKE`: creates a `LIKE` entry in `{table}_logs` and stores in `{table}_likes`.
  - `UNLIKE`: creates an `UNLIKE` entry in `{table}_logs` (does NOT delete the `LIKE` entry — both are preserved for timeline history).
- Returns `{ liked: true/false, total: N }`.
- The Activity Timeline shows both `Liked` (pink) and `Unliked` (gray) actions separately, providing a full interaction history.

### FR-006 Global Log Immutability
- `sys_audit_log` has no `UPDATE` or `DELETE` API endpoint.
- Database user permissions must restrict UPDATE/DELETE on `sys_audit_log` to no application role.
- Any attempt to modify an audit log record via the API returns 405 Method Not Allowed.

### FR-007 Async Writing (Both Logs)
- Log writes are non-blocking — happen asynchronously after event emission.
- A failed log write does NOT roll back the primary document write.
- Failed writes are retried via Redis queue with exponential backoff.
- Persistent failures are logged to application error log.

### FR-008 Querying
- **Activity Timeline** (frontend) uses: `GET /api/v1/audit/doc/{doctype}/{id}` (record-level) or `GET /api/v1/audit?doctype={name}` (DocType-level).
- These endpoints query `{table_name}_logs` (local log) — not `sys_audit_log`.
- Global Log: `GET /api/v1/audit` (admin), `GET /api/v1/audit/user/{id}` — queries `sys_audit_log`.
- Results paginated (max 100 per page).

### FR-009 Retention Policy
- Local Log: configurable retention (default: 180 days). Old entries soft-purged.
- Global Log: retained indefinitely by default. Optional cold export before deletion.

### FR-010 Activity Timeline Display Format
- Each timeline row displays: **User Avatar**, **User Name**, **Action Label**, `, ID {doc_id}`, and if `content` is non-empty: `({content})`.
- Example with content: `Sutikno Liked, ID 7 (Budi Santoso)`
- Example without content: `Sutikno Created, ID 7`
- The comma (`,`) has no space before it — format is `{Action}, ID {id}` not `{Action} , ID {id}`.
- Action label colors: green=Created, blue=Updated, red=Deleted, orange=Locked, purple=Unlocked, teal=Submitted, pink=Liked, gray=Unliked, indigo=Commented.

---

## Architecture

```
CRUD Engine / Lifecycle Engine
      │
      ▼
Event Engine.emit('{doctype}.after_update', payload)
      │
      ├──► [primary] DB write already done
      │
      └──► Audit Engine (async event subscriber)
                │
                ├──► LOCAL LOG writer
                │     ├── Build human-readable change_summary
                │     └── INSERT into dt_{doctype}_logs
                │
                └──► GLOBAL LOG writer
                      ├── Compute full field diff (before vs. after)
                      ├── Capture IP, user agent, metadata
                      └── INSERT into sys_audit_log (immutable)

── Social path ──────────────────────────────────────────────────────
POST /api/v1/doc/{DocType}/{id}/comment
      │
      └──► Comment Service
                ├── INSERT into dt_{doctype}_logs (action = COMMENT)
                └── Emit {doctype}.comment event (for plugins)

POST /api/v1/doc/{DocType}/{id}/like
      │
      └──► Like Service
                ├── UPSERT into dt_{doctype}_likes
                ├── INSERT into dt_{doctype}_logs (action = LIKE/UNLIKE)
                └── Emit {doctype}.liked event (for plugins)
```

---

## Database Design

### A. Local Log — `dt_{doctype}_logs`

One table per DocType. Created automatically when the DocType table is created.

For example, DocType `Customer` → `dt_customer_logs`.

| Column | Type | Description |
|--------|------|-------------|
| `id` | VARCHAR(36) | UUID PK |
| `tenant_id` | VARCHAR(36) | Tenant reference |
| `doctype` | VARCHAR(100) | DocType name |
| `doc_id` | VARCHAR(36) | FK → record in `dt_{doctype}` |
| `doc_name` | VARCHAR(255) | Human-readable record title at time of action |
| `action` | VARCHAR(30) | CREATE / UPDATE / DELETE / SUBMIT / CANCEL / LOCK / UNLOCK / COMMENT / LIKE / UNLIKE / AMEND / ARCHIVE / WORKFLOW |
| `user_id` | VARCHAR(36) | FK → sys_user.id |
| `user_name` | VARCHAR(200) | Snapshot of user display name |
| `user_avatar` | VARCHAR(255) | Avatar URL at time of action |
| `comment` | TEXT | Comment text (COMMENT actions only) |
| `diff` | JSON | Brief field summary (UPDATE only, no full before/after) |
| `change_summary` | TEXT | Human-readable single-line description |
| `created_at` | DATETIME | Timestamp |

```sql
INDEX idx_doclogs_doc     (tenant_id, doc_id, created_at)
INDEX idx_doclogs_doctype (tenant_id, doctype, created_at)
INDEX idx_doclogs_user    (tenant_id, user_id, created_at)
INDEX idx_doclogs_action  (tenant_id, action, created_at)
```

### B. Local Like Table — `dt_{doctype}_likes`

| Column | Type | Description |
|--------|------|-------------|
| `id` | VARCHAR(36) | UUID PK |
| `tenant_id` | VARCHAR(36) | Tenant reference |
| `doc_id` | VARCHAR(36) | FK → record |
| `user_id` | VARCHAR(36) | FK → sys_user.id |
| `created_at` | DATETIME | When liked |

```sql
UNIQUE INDEX idx_likes_unique (tenant_id, doc_id, user_id)
```

### C. Global Log — `sys_audit_log`

One global table. Immutable. Used for compliance and forensics.

| Column | Type | Description |
|--------|------|-------------|
| `id` | VARCHAR(36) | UUID PK |
| `tenant_id` | VARCHAR(36) | Tenant reference |
| `doctype` | VARCHAR(100) | DocType name |
| `doc_id` | VARCHAR(36) | Document UUID |
| `doc_name` | VARCHAR(255) | Document title at time of action |
| `action` | VARCHAR(30) | CREATE / UPDATE / SUBMIT / CANCEL / DELETE / LOGIN / PERMISSION_CHANGED / etc. |
| `user_id` | VARCHAR(36) | FK → sys_user.id |
| `user_name` | VARCHAR(200) | Snapshot of user name |
| `ip_address` | VARCHAR(45) | Client IP address |
| `user_agent` | TEXT | Client user agent string |
| `diff` | JSON | Full field-level before/after values (UPDATE only) |
| `change_summary` | TEXT | Human-readable change description |
| `metadata` | JSON | Additional context (reason, workflow action, etc.) |
| `created_at` | DATETIME | Immutable record timestamp |

> **No `updated_at`, `status`, or delete columns.** Audit records are created once and never modified.

```sql
INDEX idx_audit_doc      (tenant_id, doctype, doc_id, created_at)
INDEX idx_audit_user     (tenant_id, user_id, created_at)
INDEX idx_audit_action   (tenant_id, action, created_at)
INDEX idx_audit_tenant   (tenant_id, created_at)
FULLTEXT idx_audit_summary (change_summary)
```

#### Database Privileges (Global Log)

```sql
-- Application DB user has NO UPDATE or DELETE on sys_audit_log
GRANT SELECT, INSERT ON framee.sys_audit_log TO 'framee_app'@'%';
REVOKE UPDATE, DELETE ON framee.sys_audit_log FROM 'framee_app'@'%';
```

---

## API Design

### Local Log APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/logs/{doctype}` | DocType-level activity (latest N, all records) |
| `GET` | `/api/v1/logs/{doctype}/{id}` | Record-level activity timeline |
| `POST` | `/api/v1/doc/{doctype}/{id}/comment` | Post a comment on a record |
| `PUT` | `/api/v1/doc/{doctype}/{id}/comment/{commentId}` | Edit own comment (within edit window) |
| `DELETE` | `/api/v1/doc/{doctype}/{id}/comment/{commentId}` | Delete own comment |
| `POST` | `/api/v1/doc/{doctype}/{id}/like` | Toggle like on a record |

### Global Log APIs (Admin only)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/audit` | Query full global audit log |
| `GET` | `/api/v1/audit/doc/{doctype}/{id}` | All audit events for a document |
| `GET` | `/api/v1/audit/user/{user_id}` | All audit events by a user |
| `GET` | `/api/v1/audit/export` | Export audit log as CSV |

> No `POST`, `PUT`, or `DELETE` endpoints for `sys_audit_log`.

#### Example — Local Log Response: `GET /api/v1/logs/DocType/uuid-123`

```json
{
  "success": true,
  "data": [
    {
      "id": "log-uuid-1",
      "action": "CREATE",
      "user_name": "Sutikno Sofjan",
      "user_avatar": "/avatars/s.png",
      "change_summary": "Created",
      "created_at": "2026-07-12T03:50:00Z"
    },
    {
      "id": "log-uuid-2",
      "action": "LOCK",
      "user_name": "Sutikno Sofjan",
      "user_avatar": "/avatars/s.png",
      "change_summary": "Locked",
      "created_at": "2026-07-12T05:21:00Z"
    },
    {
      "id": "log-uuid-3",
      "action": "COMMENT",
      "user_name": "Budi Santoso",
      "user_avatar": "/avatars/b.png",
      "comment": "Sudah saya cek, OK.",
      "change_summary": "Commented",
      "created_at": "2026-07-12T08:00:00Z"
    }
  ],
  "meta": { "total": 3 }
}
```

---

## UI Behaviour

### A. Activity Timeline in PageIndex (Local Log — DocType level)

Displayed **below** the data table on the list page:

```
⚡ Activity Timeline
──────────────────────────────────────────────────────────────────────
[S] Sutikno Sofjan, ID 204 (Translation)  Deleted     Jul 12, 05:52
[S] Sutikno Sofjan, ID 313 (Translate)    Created     Jul 12, 05:27
[S] Sutikno Sofjan, ID 204 (Translation)  Unlocked    Jul 12, 05:21
[S] Sutikno Sofjan, ID 312 (Translate)    Created     Jul 12, 05:02
[S] Sutikno Sofjan, ID 203 (Language)     Locked      Jul 12, 03:50
                                                    [Show more...]
```

- Data source: `GET /api/v1/logs/{doctype}?limit=20`
- Shows latest events across ALL records of this DocType.
- Action badge color: green=Created, blue=Updated, red=Deleted, orange=Locked, teal=Unlocked, purple=Commented, pink=Liked.

### B. Activity Timeline in ViewModal (Local Log — Record level)

Displayed at the **bottom of the ViewModal**, below the Engagement Row:

```
⚡ Activity Timeline
──────────────────────────────────────────────────────────────────────
● Sutikno Sofjan   Created                            Jul 12, 05:27
● Sutikno Sofjan   Updated (name, label)              Jul 12, 05:35
● Sutikno Sofjan   Locked                             Jul 12, 05:52
● Budi Santoso     Commented: "Sudah saya cek, OK."  Jul 12, 08:00
● Siti Rahayu      Liked                              Jul 12, 09:10
```

- Data source: `GET /api/v1/logs/{doctype}/{id}`
- Shows ALL events for this specific record, in chronological order.
- Comments show the full comment text inline.
- System events (Create, Lock, etc.) show action badge.

### C. Global Audit Log Admin Page

- System Manager can access `/admin/audit-log`.
- Filters: DocType, User, Action type, Date range, IP address.
- Columns: Timestamp, DocType, Document, Action, User, IP, Summary.
- Row expand: shows full `diff` before/after values.
- Export to CSV.

---

## Configuration

| Config Key | Default | Description |
|------------|---------|-------------|
| `AUDIT_ENABLED` | `true` | Enable audit logging |
| `AUDIT_LOG_LOGINS` | `true` | Log login/logout events to global log |
| `AUDIT_LOG_PERMISSION_CHANGES` | `true` | Log role/permission changes |
| `AUDIT_DIFF_MAX_FIELD_VALUE_LENGTH` | `500` | Truncate long field values in diff |
| `AUDIT_RETENTION_DAYS` | `0` | 0 = indefinite (global log) |
| `AUDIT_LOCAL_RETENTION_DAYS` | `180` | Local log retention |
| `AUDIT_WRITE_QUEUE_KEY` | `framee:queue:audit` | Redis retry queue key |
| `AUDIT_SENSITIVE_FIELDTYPES` | `['Password']` | Field types excluded from diff |
| `COMMENT_EDIT_WINDOW_MINUTES` | `15` | Window to edit own comment |

---

## Validation Rules

- Global Log records are write-once:
  1. API: no PUT/DELETE endpoints.
  2. Database: explicit REVOKE of UPDATE/DELETE on `sys_audit_log`.
- Failed audit write must NOT rollback the document write.
- `diff` contains only changed fields.
- Sensitive field types (`Password`) never appear in `diff`.
- Comment edit/delete only allowed by the author within `COMMENT_EDIT_WINDOW_MINUTES`.

---

## Security

- Global audit query endpoints require System Manager or Auditor role.
- Document-level audit (`/audit/doc/{doctype}/{id}`) requires `read` permission on that DocType.
- Global audit records never deleted via the API.
- IP address and user agent captured for forensics.
- Local Log is user-visible; Global Log is admin-only.

---

## Events

### Listened Events

| Event | Local Log | Global Log |
|-------|-----------|------------|
| `{doctype}.after_insert` | ✅ | ✅ |
| `{doctype}.after_update` | ✅ | ✅ (with diff) |
| `{doctype}.submitted` | ✅ | ✅ |
| `{doctype}.cancelled` | ✅ | ✅ |
| `{doctype}.deleted` | ✅ | ✅ |
| `{doctype}.locked` | ✅ | ✅ |
| `{doctype}.unlocked` | ✅ | ✅ |
| `{doctype}.comment` | ✅ | ❌ |
| `{doctype}.liked` | ✅ | ❌ |
| `user.login` | ❌ | ✅ |
| `user.role_assigned` | ❌ | ✅ |
| `role.permission_changed` | ❌ | ✅ |

> Audit Engine emits NO events — it is a pure subscriber.

---

## Performance

- All audit writes async (event subscriber, fire-and-forget for primary request).
- Failed writes queued in Redis (`LPUSH framee:queue:audit`) and retried by background worker.
- Audit log queries use indexed lookups — no full table scans.
- Local log table is small and fast — used for UI display.
- Global log table is large but write-only from application perspective.

---

## Future Improvements

- **Digital Signature** — Sign global audit records to make tampering detectable.
- **External Audit Export** — Push events to SIEM (Splunk, ELK) via webhook.
- **Audit Report** — Pre-built report: all changes to a DocType in a date range.
- **Compliance Profiles** — Pre-configured audit settings for SOX, ISO 27001.
- **Real-time Activity Feed** — WebSocket push to Activity Timeline.

---

## Acceptance Criteria

- [ ] Creating a document generates a `CREATE` entry in both `dt_{doctype}_logs` and `sys_audit_log`.
- [ ] Updating fields generates `UPDATE` in Local Log (summary only) and Global Log (with full diff).
- [ ] Diff in Global Log shows only changed fields with before/after values.
- [ ] `Password` field never appears in any diff.
- [ ] Posting a comment creates a `COMMENT` entry in Local Log only.
- [ ] Liking a record creates `LIKE` in Local Log and upserts in `dt_{doctype}_likes`.
- [ ] Activity Timeline in pageIndex shows latest 20 events for the DocType.
- [ ] Activity Timeline in ViewModal shows all events for the specific record.
- [ ] Global Log: no `PUT` or `DELETE` endpoint — returns 405.
- [ ] DB user cannot UPDATE/DELETE `sys_audit_log` (permission test).
- [ ] Failed audit write does NOT rollback document write.
- [ ] Admin can query and export Global Log filtered by DocType, user, date.

---

## Notes

- **Two logs, two purposes.** Local Log = user-facing activity, social, lightweight. Global Log = compliance, forensics, immutable, complete.
- **Audit Engine is a subscriber, never a caller.** No code calls `AuditEngine.log()`. Events drive everything.
- **`track_changes = true`** on DocType controls UPDATE diff recording. Lifecycle events (CREATE/SUBMIT/DELETE) always written regardless.
- **Local Log tables are named consistently:** `dt_{doctype_snake}_logs` and `dt_{doctype_snake}_likes`. Created automatically alongside the DocType data table.
- **Performance on high-volume DocTypes:** Consider setting `track_changes = false` and relying only on lifecycle event auditing to reduce log growth.
