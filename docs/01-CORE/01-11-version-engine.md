# 01-11 Version Engine

## Purpose

The Version Engine is Framee's **document version history and snapshot system**. Every time a document is saved, the Version Engine captures a complete snapshot of its field values. This snapshot history allows users to see exactly what a document looked like at any point in time, compare versions side-by-side, and — with appropriate permissions — restore a document to a previous state.

Where the Audit Engine answers "what changed and who changed it", the Version Engine answers "what did this document look like on July 1st?" and "can I go back to the version before the last save?".

---

## Goals

1. Capture a full field-value snapshot of a document on every save.
2. Store snapshots as immutable, timestamped version records.
3. Allow users to browse version history in a timeline UI.
4. Allow users to compare any two versions side-by-side.
5. Allow authorized users to restore a document to a previous version.
6. Be performance-neutral — snapshot writing is async and non-blocking.
7. Support configurable retention policies to manage storage growth.

---

## Scope

### In Scope
- Full-document snapshot on every `UPDATE` (and on `INSERT` as Version 1)
- Version metadata: version number, user, timestamp, change summary
- Version history API (list + get single version)
- Version comparison API (diff between any two versions)
- Version restore API (restore a document to a prior version, subject to Lifecycle rules)
- Version viewer UI in the Dynamic Form
- Configurable retention: maximum N versions per document, or N days

### Out of Scope
- Field-level diff audit trail (handled by Audit Engine — `01-10`)
- Workflow history (stored in `sys_workflow_history`)
- Database schema migrations / table version history (separate concern)
- Binary file (Attach) version storage (only file references are versioned, not file contents)

---

## Functional Requirements

### FR-001 Automatic Snapshot on Save
- The Version Engine subscribes to `{doctype}.after_insert` and `{doctype}.after_update` events.
- On each event, a snapshot of the complete document field values is taken and stored.
- The first snapshot (on create) is `version = 1`.
- Each subsequent snapshot increments the version counter for that document.

### FR-002 Version Record Content
- A version record stores:
  - `version_number` — integer, monotonically increasing per document.
  - `snapshot` — JSON of all field values at that moment.
  - `saved_by` — user who triggered the save.
  - `saved_at` — exact timestamp of the save.
  - `change_summary` — auto-generated or user-provided description.
  - `is_current` — boolean flag marking the most recent version.

### FR-003 Version History API
- Users can list all versions for a document (paginated, most recent first).
- Users can fetch a specific version's full snapshot.
- Access requires `read` permission on the DocType.

### FR-004 Version Comparison
- Users can request a diff between any two version numbers for a document.
- The response includes field-by-field before/after for fields that differed between the two versions.

### FR-005 Version Restore
- Authorized users (with `write` permission + document not Locked) can restore a document to a specific version.
- Restore creates a NEW save (triggering another snapshot) with the restored field values.
- Restore does NOT rewrite history — the existing version history is preserved and the restore itself becomes a new version.
- Restore is blocked on documents with `status = Locked`, `status = Cancelled`, or `status = Deleted`.

### FR-006 Controlled by DocType Metadata
- Only DocTypes with `track_changes = true` have version history.
- DocTypes with `track_changes = false` do not generate version snapshots (saves are not versioned).

### FR-007 Retention Policy
- Maximum versions per document is configurable (`VERSION_MAX_PER_DOC`).
- When the limit is exceeded, the oldest version is pruned.
- Exception: version corresponding to a `Submitted` status transition is marked `is_protected = true` and is never pruned.
- Time-based retention: versions older than `VERSION_RETENTION_DAYS` are pruned (0 = indefinite).

---

## Architecture

```
CRUD Engine saves document
      │
      ▼
Event Engine.emit('{doctype}.after_update', { doc_id, before, after })
      │
      └──► Version Engine (async event subscriber)
                │
                ├── Fetch current document field values (from after payload)
                ├── Build snapshot JSON
                ├── Increment version counter
                ├── Mark previous version is_current = false
                ├── INSERT new sys_doc_version record (is_current = true)
                └── Prune oldest if version count > VERSION_MAX_PER_DOC
```

### Version Number Sequence per Document

```
Document: INV-0001
Version 1 → Created by Budi on Jul 01 09:00  (INSERT)
Version 2 → Updated by Budi on Jul 01 10:15  (qty: 10 → 12)
Version 3 → Updated by Siti on Jul 02 08:00  (notes added)
Version 4 → Submitted by Siti on Jul 02 08:01  (status: Draft → Submitted)  ← is_protected
```

---

## Database Design

### `sys_doc_version` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | VARCHAR(36) | UUID PK |
| `tenant_id` | VARCHAR(36) | Tenant reference |
| `doctype` | VARCHAR(100) | DocType name |
| `doc_id` | VARCHAR(36) | Document UUID |
| `version_number` | INT | Monotonically increasing per document |
| `snapshot` | LONGTEXT | Full JSON snapshot of all field values |
| `change_summary` | TEXT | Auto-generated description (e.g., "Updated qty, price") |
| `saved_by` | VARCHAR(36) | FK → sys_user.id |
| `saved_by_name` | VARCHAR(200) | Snapshot of user name at save time |
| `saved_at` | DATETIME | Exact save timestamp |
| `is_current` | TINYINT(1) | Marks the most recent version |
| `is_protected` | TINYINT(1) | Never pruned (e.g., submit snapshots) |
| `trigger_event` | VARCHAR(50) | Event that triggered this version (after_insert / after_update / submitted / etc.) |

> Version records are **immutable** — no UPDATE or DELETE via application API.
> Pruning (deletion of oldest version) is performed only by the internal retention job, with `is_protected` records always excluded.

### Indexes

```sql
INDEX idx_version_doc      (tenant_id, doctype, doc_id, version_number)
INDEX idx_version_current  (tenant_id, doctype, doc_id, is_current)
INDEX idx_version_user     (tenant_id, saved_by, saved_at)
```

### Version Counter

The highest `version_number` per `(tenant_id, doctype, doc_id)` is stored in Redis for fast increment:

```
Key: framee:version:{tenant_id}:{doctype}:{doc_id}
Value: {current_max_version}
TTL: none (persistent)
```

---

## API Design

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/doc/{DocType}/{id}/versions` | List all versions for a document |
| `GET` | `/api/v1/doc/{DocType}/{id}/versions/{version_number}` | Get a specific version snapshot |
| `GET` | `/api/v1/doc/{DocType}/{id}/versions/compare?v1={n}&v2={m}` | Compare two versions |
| `POST` | `/api/v1/doc/{DocType}/{id}/versions/{version_number}/restore` | Restore document to version |

> No `PUT` or `DELETE` endpoints for version records.

#### Example — `GET /api/v1/doc/SalesInvoice/inv-001/versions`

```json
{
  "success": true,
  "data": [
    {
      "version_number": 4,
      "is_current": true,
      "is_protected": true,
      "trigger_event": "submitted",
      "saved_by_name": "Siti Rahayu",
      "saved_at": "2026-07-02T08:01:00Z",
      "change_summary": "Document submitted."
    },
    {
      "version_number": 3,
      "is_current": false,
      "trigger_event": "after_update",
      "saved_by_name": "Siti Rahayu",
      "saved_at": "2026-07-02T08:00:00Z",
      "change_summary": "Updated notes"
    },
    {
      "version_number": 2,
      "is_current": false,
      "trigger_event": "after_update",
      "saved_by_name": "Budi Santoso",
      "saved_at": "2026-07-01T10:15:00Z",
      "change_summary": "Updated qty (10 → 12), price (100,000 → 120,000)"
    },
    {
      "version_number": 1,
      "is_current": false,
      "is_protected": false,
      "trigger_event": "after_insert",
      "saved_by_name": "Budi Santoso",
      "saved_at": "2026-07-01T09:00:00Z",
      "change_summary": "Document created."
    }
  ]
}
```

#### Example — `GET .../versions/compare?v1=1&v2=3`

```json
{
  "success": true,
  "data": {
    "doctype": "SalesInvoice",
    "doc_id": "inv-001",
    "version_a": 1,
    "version_b": 3,
    "diff": {
      "qty": { "v1": 10, "v2": 12 },
      "price": { "v1": 100000, "v2": 120000 },
      "notes": { "v1": null, "v2": "Revised per customer request" }
    }
  }
}
```

#### Example — `POST .../versions/2/restore`

```json
{
  "success": true,
  "data": {
    "id": "inv-001",
    "restored_from_version": 2,
    "new_version": 5,
    "message": "Document restored to Version 2. Current version is now 5."
  }
}
```

---

## UI Behaviour

### Version History Panel in Dynamic Form
- A "Versions" tab or collapsible section at the bottom of the form.
- Displays a timeline of versions (most recent first).
- Each row: version number, saved by, timestamp, change summary, \[View\] \[Compare\] buttons.
- "View" opens a read-only snapshot of that version's field values.
- "Compare" opens a side-by-side diff view between the selected version and the current version.
- "Restore to this version" button (visible only if user has write permission and document is not Locked).

### Version Compare View

```
┌────────────────────┬────────────────────┐
│ Version 2          │ Current (v4)        │
│ Jul 1, 10:15       │ Jul 2, 08:01        │
├────────────────────┼────────────────────┤
│ qty:  [10] ←changed│ qty:  12            │
│ price:[100K]←change│ price:120,000       │
│ notes: —           │ notes: "Revised..." │
│ total: same        │ total: same         │
└────────────────────┴────────────────────┘
```

Changed fields are highlighted. Identical fields are shown without highlight.

---

## Configuration

| Config Key | Default | Description |
|------------|---------|-------------|
| `VERSION_ENABLED` | `true` | Enable Version Engine globally |
| `VERSION_MAX_PER_DOC` | `50` | Max versions retained per document |
| `VERSION_RETENTION_DAYS` | `0` | 0 = indefinite. Days to retain non-protected versions |
| `VERSION_SNAPSHOT_EXCLUDES` | `['password_hash']` | Field names never included in snapshots |
| `VERSION_ASYNC_WRITE` | `true` | Write versions asynchronously (non-blocking) |
| `VERSION_PRUNE_BATCH_SIZE` | `100` | Records pruned per retention job run |

---

## Validation Rules

- Version records are immutable. No application API allows updating or deleting them.
- Restore is blocked on documents with `status = Locked`, `status = Cancelled`, `status = Deleted`.
- Restore is also blocked if the user lacks `write` permission on the DocType.
- `is_protected` versions are never pruned by the retention job.
- Only DocTypes with `track_changes = true` generate version records.
- `VERSION_SNAPSHOT_EXCLUDES` field names must not appear in any snapshot JSON.

---

## Security

- Version history requires `read` permission on the DocType.
- Version restore requires `write` permission on the DocType AND document `status` must be in an editable state.
- Version snapshots must exclude sensitive fields (`password_hash`, etc.) as configured in `VERSION_SNAPSHOT_EXCLUDES`.
- System Manager can view version history for any DocType, including deleted documents.
- Version records for deleted documents are retained until explicitly pruned by the retention policy.

---

## Events

### Listened Events (Version Engine subscribes to)

| Event | Action |
|-------|--------|
| `{doctype}.after_insert` | Snapshot Version 1 |
| `{doctype}.after_update` | Snapshot new version |
| `{doctype}.submitted` | Snapshot + mark `is_protected = true` |
| `{doctype}.cancelled` | Snapshot final state |

### Emitted Events (Version Engine emits)

| Event | Trigger |
|-------|---------|
| `version.created` | New version snapshot written |
| `version.restored` | Document restored to prior version |
| `version.pruned` | Old version pruned by retention job |

---

## Performance

### Async Writes
- Version snapshots are written asynchronously (event-driven subscriber).
- The primary CRUD request is not blocked by snapshot writing.
- Failed snapshot writes are retried from a Redis queue.

### Snapshot Size
- `snapshot` field is a full JSON dump of all document fields.
- For large documents (50+ fields), consider storing compressed snapshots (gzip).
- `VERSION_MAX_PER_DOC` limits unbounded growth per document.

### Version Counter in Redis
- Using Redis for the version counter avoids a `MAX(version_number)` query per save.
- Atomic `INCR` ensures no duplicate version numbers under concurrent saves.

### Pruning
- Retention pruning runs as a scheduled background job (not inline on save).
- Batch size is configurable to avoid long-running transactions.

---

## Future Improvements

- **Branch Versions** — Tag specific versions as "milestones" with user-defined names.
- **Diff Email Notification** — Notify stakeholders when a specific field changes.
- **Compressed Snapshots** — gzip compression for `snapshot` JSON to reduce storage.
- **Version Merge** — Resolve conflicts when two users save the same document simultaneously.
- **API-Accessible Restore** — Programmatic restore via plugin hooks (useful for data pipeline rollbacks).

---

## Acceptance Criteria

- [ ] Creating a document generates Version 1 with a complete field snapshot.
- [ ] Saving a document generates a new version with an incremented `version_number`.
- [ ] `GET .../versions` returns all versions in reverse chronological order.
- [ ] `GET .../versions/2` returns the complete field snapshot for Version 2.
- [ ] `GET .../versions/compare?v1=1&v2=3` returns only the fields that changed between those two versions.
- [ ] `POST .../versions/2/restore` sets the document fields to Version 2 values and creates a new Version N.
- [ ] Restore on a `Locked` document returns 422.
- [ ] Restore on a `Submitted` document (when `allow_edit_after_submit = false`) returns 422.
- [ ] `is_protected = true` versions are never pruned by the retention job.
- [ ] When `VERSION_MAX_PER_DOC = 10`, saving the 11th version prunes the oldest non-protected version.
- [ ] Sensitive fields in `VERSION_SNAPSHOT_EXCLUDES` do not appear in any snapshot JSON.
- [ ] The Versions tab in the Dynamic Form displays the timeline with correct metadata.

---

## Notes

- **Version Engine vs. Audit Engine**: The Audit Engine records *what changed and who changed it* (a log of actions). The Version Engine records *what the document looked like* (complete snapshots). Both serve different purposes. The Audit Engine is for compliance; the Version Engine is for user-facing history and restore.
- **Restore creates a new version — history is never rewritten.** If a user restores to Version 2, the document becomes Version 5 (or whatever is next). Versions 3 and 4 still exist in history. This preserves the integrity of the version chain.
- **Snapshot JSON is the source for restoration.** The `snapshot` field must contain all user-managed field values. System fields (`id`, `tenant_id`, `status`, `created_at`, `created_by`) are excluded from the snapshot and restored from the current document record.
- **For high-transaction DocTypes** (stock entries, payment transactions), `track_changes = false` and a compressed snapshot strategy should be evaluated to prevent excessive `sys_doc_version` table growth.
