# 01-09 Document Lifecycle Engine

## Purpose

The Document Lifecycle Engine is the **central authority for document status transitions** in Framee. It controls when a document can be created, edited, submitted, locked, cancelled, amended, or deleted — and enforces these rules consistently across every DocType.

Rather than scattering `if (doc.status === 'Locked')` checks throughout the codebase, all document state transition logic is centralized here. Every write operation on any document passes through the Document Lifecycle Engine before reaching the database.

It exists because ERP data integrity is non-negotiable. A posted Sales Invoice must not have its total quietly changed three months later. A Journal Entry that has been reversed must not be editable. The Lifecycle Engine enforces these guarantees at the framework level so that no plugin or developer can accidentally bypass them.

---

## Goals

1. Replace scattered `is_deleted` and `is_locked` flags with a rich, consistent `status` field on every document.
2. Define a configurable lifecycle per DocType through metadata (not code).
3. Provide a centralized "Can I do this?" gate before every write operation.
4. Support standard ERP lifecycle patterns: Draft → Submit → Lock → Cancel → Amend.
5. Emit lifecycle events that the Event Engine, Audit Engine, and Workflow Engine can react to.
6. Make audit traces reliable — once a document is Locked, its data is guaranteed to be immutable.

---

## Scope

### In Scope
- Document status model (Draft, Submitted, Locked, Cancelled, Archived, Deleted)
- DocType-level lifecycle metadata configuration (`allow_edit_after_submit`, `allow_cancel`, `allow_amend`, `allow_duplicate`, `allow_delete`)
- Centralized `canPerform(action, doc, user)` function
- Status transition enforcement before every CRUD write
- Status transition API endpoints (submit, cancel, amend, archive, delete)
- Integration with Permission Engine, Workflow Engine, and Field Permission checks
- Emitting lifecycle events for downstream engines (Audit, Version, Workflow)

### Out of Scope
- Workflow state transitions (handled by Workflow Engine — `01-08`). Lifecycle status and workflow state are separate concerns.
- Audit log writing (handled by Audit Engine — `01-10`)
- Version snapshotting (handled by Version Engine — `01-11`)
- UI transition buttons (handled by Dynamic Form — `03-02`)

---

## Functional Requirements

### FR-001 Document Status Model

Every document in Framee has a single `status` field. The possible values and their meaning:

| Status | Description | Editable? |
|--------|-------------|-----------|
| `Draft` | Document created, not yet submitted or finalized | ✅ Yes |
| `Submitted` | Document has been formally submitted/posted | ❌ No (unless `allow_edit_after_submit`) |
| `Locked` | Document is permanently sealed (e.g., posted journal) | ❌ Never |
| `Cancelled` | Document has been cancelled; a cancellation trail exists | ❌ No |
| `Archived` | Document is historical and read-only, not deleted | ❌ No |
| `Deleted` | Soft-deleted; records `deleted_at`, `deleted_by`, `delete_reason` | ❌ No |

> **Note**: Status is separate from the Workflow State. A document can be in `status = Draft` while its workflow state is `Pending Approval`. These are orthogonal concepts.

### FR-002 DocType Lifecycle Metadata

Each DocType declares its lifecycle behavior in `sys_doctype` metadata:

| Field | Type | Description |
|-------|------|-------------|
| `has_lifecycle` | TINYINT(1) | Enable Lifecycle Engine checks for this DocType |
| `initial_status` | VARCHAR(20) | Status assigned on record creation (default: `Draft`) |
| `allow_edit_after_submit` | TINYINT(1) | Allow field edits after Submitted (rare, e.g., notes-only fields) |
| `allow_cancel` | TINYINT(1) | Allow transitioning to Cancelled |
| `allow_amend` | TINYINT(1) | Allow creating an Amendment from a Submitted/Locked record |
| `allow_duplicate` | TINYINT(1) | Allow creating a copy of any record |
| `allow_delete` | TINYINT(1) | Allow soft deletion |
| `lock_on_submit` | TINYINT(1) | Automatically lock when status → Submitted |
| `lock_fields_after_submit` | JSON | Specific field names that become read-only on Submitted |

### FR-003 Centralized Rule Check — `canPerform()`

Before any write operation, the CRUD Engine calls the Lifecycle Engine's `canPerform()` function:

```
canPerform(action, doc, user) → { allowed: bool, reason: string }
```

**Action types**: `create`, `read`, `update`, `delete`, `submit`, `cancel`, `amend`, `archive`, `duplicate`

**Check sequence (all must pass):**

```
canPerform(action, doc, user)
  │
  ├── 1. Permission Engine
  │       → Does the user's role have this action on this DocType?
  │
  ├── 2. Document Status
  │       → Is the current status compatible with this action?
  │         (e.g., cannot update a Locked document)
  │
  ├── 3. Workflow Engine
  │       → Is the workflow state compatible? (if workflow is active)
  │
  ├── 4. Field Permission
  │       → Are the specific fields being modified writable?
  │
  └── 5. DocType Lifecycle Config
          → Does the DocType allow this action?
          (e.g., allow_delete = false → block delete regardless of role)
```

### FR-004 Status Transition Rules

| Current Status | Allowed Transitions |
|---------------|---------------------|
| `Draft` | → `Submitted`, → `Deleted` |
| `Submitted` | → `Locked` (if `lock_on_submit`), → `Cancelled` (if `allow_cancel`), → `Amended` (creates new doc) |
| `Locked` | → `Cancelled` (only via Reversal document — no direct field edits) |
| `Cancelled` | → `Deleted` |
| `Archived` | → `Deleted` |
| `Deleted` | → (terminal — no transitions) |

> **Invalid transitions are rejected with a descriptive error**, not silently ignored.

### FR-005 Amendment Flow

When a user amends a Submitted/Locked document:
1. A new document is created with status = `Draft` and all field values copied from the original.
2. The new document has a `amended_from` field pointing to the original document's ID.
3. The original document's status becomes `Cancelled` (or retains `Locked`, depending on DocType config).
4. The amendment document goes through its own lifecycle independently.

### FR-006 Deletion Model

Deletion is a status transition, not a database row removal. Soft delete sets:
- `status = Deleted`
- `deleted_at = NOW()`
- `deleted_by = current_user.id`
- `delete_reason = user-provided reason` (required if `require_delete_reason = true` on DocType)

There is NO `is_deleted` column. All queries filter by `status != 'Deleted'` by default.

### FR-007 Locked Fields After Submit

For DocTypes with `lock_fields_after_submit` configured:
- On any `update` attempt to a `Submitted` document, the Lifecycle Engine checks whether the modified fields are in the `lock_fields_after_submit` list.
- If a locked field is in the payload, the update is rejected with a field-level error.
- Non-locked fields (e.g., `notes`, `tags`) can still be edited after submit.

---

## Architecture

### Lifecycle Check Flow (Every Write Operation)

```
API Request → CRUD Engine
                  │
                  ▼
          ┌─────────────────────────────────────────────┐
          │         Document Lifecycle Engine            │
          │                                             │
          │  1. Permission Engine.check(user, doctype, action)
          │     → 403 if no role permission             │
          │                                             │
          │  2. Status.check(doc.status, action)        │
          │     → 422 if status blocks action           │
          │                                             │
          │  3. Workflow Engine.check(doc, user, action)│
          │     → 422 if workflow state blocks action   │
          │                                             │
          │  4. FieldPermission.check(user, fields)     │
          │     → 422 if locked fields in payload       │
          │                                             │
          │  5. DocType.config.check(action)            │
          │     → 422 if DocType config blocks action   │
          │                                             │
          │  → ALL PASS: proceed to Database Engine     │
          │  → ANY FAIL: return error immediately       │
          └─────────────────────────────────────────────┘
                  │
                  ▼
          Database Engine (execute write)
                  │
                  ▼
          Event Engine.emit('{doctype}.{action}')
                  │
                  ├──► Audit Engine.record()
                  └──► Version Engine.snapshot()
```

### DocType Lifecycle Examples

```
Customer (simple, no submit)
  has_lifecycle: true
  initial_status: Active
  allow_edit_after_submit: true
  allow_delete: true
  lock_on_submit: false

  Lifecycle: Draft → Active → Deleted

Sales Invoice (submittable)
  has_lifecycle: true
  initial_status: Draft
  allow_cancel: true
  allow_amend: true
  allow_delete: false
  lock_on_submit: true
  lock_fields_after_submit: ['total', 'tax_amount', 'items']

  Lifecycle: Draft → Submitted (Locked) → Cancelled → Amended

Journal Entry (strict)
  has_lifecycle: true
  initial_status: Draft
  allow_cancel: false
  allow_amend: false
  allow_delete: false
  lock_on_submit: true

  Lifecycle: Draft → Posted (Locked Forever)
  Correction: Reverse Journal (new doc, not edit)
```

---

## Database Design

### Changes to `sys_doctype` Table

Add lifecycle configuration columns:

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `has_lifecycle` | TINYINT(1) | `0` | Enable lifecycle engine |
| `initial_status` | VARCHAR(20) | `Draft` | Status on record creation |
| `allow_edit_after_submit` | TINYINT(1) | `0` | Edit allowed post-submit |
| `allow_cancel` | TINYINT(1) | `1` | Cancellation allowed |
| `allow_amend` | TINYINT(1) | `0` | Amendment allowed |
| `allow_duplicate` | TINYINT(1) | `1` | Duplication allowed |
| `allow_delete` | TINYINT(1) | `1` | Soft deletion allowed |
| `lock_on_submit` | TINYINT(1) | `0` | Auto-lock on submit |
| `lock_fields_after_submit` | JSON | `[]` | Field names locked on submit |
| `require_delete_reason` | TINYINT(1) | `0` | Require reason for deletion |

### Changes to Every Document Table (`dt_*`)

**REMOVE**: `is_deleted TINYINT(1)`, `is_locked TINYINT(1)`

**ADD**:

| Column | Type | Description |
|--------|------|-------------|
| `status` | VARCHAR(20) | Document status (Draft/Submitted/Locked/Cancelled/Archived/Deleted) |
| `deleted_at` | DATETIME | Soft delete timestamp (null if not deleted) |
| `deleted_by` | VARCHAR(36) | FK → sys_user.id (who deleted) |
| `delete_reason` | TEXT | Optional reason for deletion |
| `amended_from` | VARCHAR(36) | FK → same table id (if this is an amendment) |
| `submitted_at` | DATETIME | When status → Submitted |
| `submitted_by` | VARCHAR(36) | FK → sys_user.id |
| `cancelled_at` | DATETIME | When status → Cancelled |
| `cancelled_by` | VARCHAR(36) | FK → sys_user.id |
| `cancel_reason` | TEXT | Reason for cancellation |

### Standard Column Contract (Updated)

Every `dt_*` table MUST have these columns:

```sql
id              VARCHAR(36)     NOT NULL PRIMARY KEY,
tenant_id       VARCHAR(36)     NOT NULL,
status          VARCHAR(20)     NOT NULL DEFAULT 'Draft',
created_by      VARCHAR(36)     NOT NULL,
updated_by      VARCHAR(36)     NOT NULL,
created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
deleted_at      DATETIME        NULL,
deleted_by      VARCHAR(36)     NULL,
delete_reason   TEXT            NULL,
amended_from    VARCHAR(36)     NULL,
submitted_at    DATETIME        NULL,
submitted_by    VARCHAR(36)     NULL,
cancelled_at    DATETIME        NULL,
cancelled_by    VARCHAR(36)     NULL,
cancel_reason   TEXT            NULL
```

> `is_deleted` and `is_locked` are **permanently retired** from the column contract.

### Default Query Filter

All CRUD Engine list queries automatically append:

```sql
WHERE tenant_id = ? AND status != 'Deleted'
```

Fetching a deleted document by ID returns 404 (not 403) to avoid disclosing document existence.

### `sys_lifecycle_status` Lookup Table

```sql
CREATE TABLE sys_lifecycle_status (
  id          VARCHAR(36) PRIMARY KEY,
  name        VARCHAR(20) NOT NULL UNIQUE,  -- Draft, Submitted, Locked, etc.
  label       VARCHAR(50) NOT NULL,
  description TEXT,
  color       VARCHAR(20),                  -- badge color class
  sort_order  INT DEFAULT 0
);
```

---

## API Design

### Lifecycle Action Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/doc/{DocType}/{id}/submit` | Transition Draft → Submitted |
| `POST` | `/api/v1/doc/{DocType}/{id}/cancel` | Transition → Cancelled |
| `POST` | `/api/v1/doc/{DocType}/{id}/amend` | Create amendment from Submitted/Locked |
| `POST` | `/api/v1/doc/{DocType}/{id}/archive` | Transition → Archived |
| `DELETE` | `/api/v1/doc/{DocType}/{id}` | Soft delete (→ Deleted) |
| `GET` | `/api/v1/doc/{DocType}/{id}/lifecycle` | Get current status + allowed actions |

#### Example — `GET /api/v1/doc/SalesInvoice/inv-001/lifecycle`

```json
{
  "success": true,
  "data": {
    "current_status": "Submitted",
    "allowed_actions": ["cancel", "amend", "duplicate"],
    "blocked_actions": ["update", "delete"],
    "lock_reason": "Invoice has been submitted and locked."
  }
}
```

#### Example — `POST /api/v1/doc/SalesInvoice/inv-001/cancel`

**Request:**
```json
{
  "cancel_reason": "Customer requested cancellation due to order error."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "inv-001",
    "status": "Cancelled",
    "cancelled_at": "2026-07-13T09:00:00Z",
    "cancelled_by": "user-uuid",
    "cancel_reason": "Customer requested cancellation due to order error."
  }
}
```

#### Example — `POST /api/v1/doc/SalesInvoice/inv-001/amend`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "inv-001-amend-1",
    "status": "Draft",
    "amended_from": "inv-001",
    "message": "Amendment INV-0001-A created. Original invoice has been cancelled."
  }
}
```

---

## UI Behaviour

### Status Badge
- Every document form and list row displays the current `status` as a colored `<Badge>`.
- Badge colors by status:
  - `Draft` → gray
  - `Submitted` → blue
  - `Locked` → yellow/amber
  - `Cancelled` → red
  - `Archived` → purple
  - `Deleted` → (not shown — filtered out)

### Action Buttons (Toolbar)
- `canPerform()` result drives which toolbar buttons are rendered.
- Buttons never shown for blocked actions — not shown as disabled, simply absent.
- Exception: a grayed-out button with tooltip is shown when the action is almost-accessible (e.g., user has permission but document is locked).

```
Status: Draft    → [💾 Save] [✓ Submit] [🗑 Delete]
Status: Submitted → [⊘ Cancel] [📋 Amend] [📋 Duplicate]
Status: Locked    → [⊘ Cancel (Reversal)] [📋 Duplicate]
Status: Cancelled → (read-only, no actions)
```

### Cancel / Amend Modals
- Cancellation requires a confirmation modal with a `cancel_reason` textarea.
- If `require_delete_reason = true`, deletion requires a reason textarea.
- Amendment shows: "This will cancel INV-0001 and create a new Draft INV-0001-A. Proceed?"

---

## Configuration

| Config Key | Default | Description |
|------------|---------|-------------|
| `LIFECYCLE_ENABLED` | `true` | Global toggle (disable only for testing) |
| `LIFECYCLE_DEFAULT_STATUS` | `Draft` | Default initial status if not configured per DocType |
| `LIFECYCLE_REQUIRE_CANCEL_REASON` | `true` | Require reason for all cancellations |
| `LIFECYCLE_ALLOW_UNDO_DELETE` | `false` | Allow un-deleting (restoring) deleted documents |
| `LIFECYCLE_DELETED_VISIBLE_TO_ADMIN` | `true` | System Manager can view Deleted documents |

---

## Validation Rules

- A document in `Locked` status cannot have any field updated — no exceptions. The only allowed transition is Cancel (via a formal reversal document).
- A document in `Deleted` status is invisible to all queries (status filter). System Managers can view it via admin endpoint if `LIFECYCLE_DELETED_VISIBLE_TO_ADMIN = true`.
- `amended_from` must reference a document in `Submitted`, `Locked`, or `Cancelled` status.
- Status transitions must follow the defined transition matrix — invalid transitions return 422.
- DocType config `allow_delete = false` blocks deletion even for System Managers.
- `lock_fields_after_submit` field names must match existing DocField `fieldname` values.

---

## Security

- Status transition endpoints are protected by the same Permission Engine checks as standard CRUD.
- The `canPerform()` function is the single enforced gate — bypassing it requires direct DB access (not possible via API).
- Deleted document IDs return 404 (not 403) — existence is not disclosed.
- Amendment creates a new document — the original is untouched in the database (audit-safe).

---

## Events

| Event | Payload | Trigger |
|-------|---------|---------|
| `{doctype}.submitted` | `{ id, user_id, submitted_at }` | Status → Submitted |
| `{doctype}.locked` | `{ id, user_id }` | Status → Locked |
| `{doctype}.cancelled` | `{ id, user_id, reason }` | Status → Cancelled |
| `{doctype}.archived` | `{ id, user_id }` | Status → Archived |
| `{doctype}.deleted` | `{ id, user_id, reason }` | Status → Deleted |
| `{doctype}.amended` | `{ original_id, new_id, user_id }` | Amendment created |
| `lifecycle.rule_blocked` | `{ doctype, id, action, reason }` | `canPerform()` returned false |

### Listened Events

| Event | Action |
|-------|--------|
| `DocType.after_update` | Invalidate lifecycle metadata cache for DocType |
| `plugin.registered` | Register plugin-defined lifecycle configs |

---

## Performance

- DocType lifecycle metadata is cached in Redis alongside the Metadata Engine cache.
- `canPerform()` is designed to operate entirely on cached data — no database query per check.
- Status index: `INDEX idx_dt_status (tenant_id, status)` on every `dt_*` table.
- Amendment creates one record (INSERT only) — no UPDATE on the original.

---

## Future Improvements

- **Custom Status Sets** — Allow DocTypes to define their own status values beyond the standard set.
- **Time-Based Auto-Archival** — Automatically archive documents older than N days.
- **Reversal Templates** — Pre-defined reversal document configurations per DocType.
- **Partial Amendment** — Amend only specific fields, not the entire document.
- **Restore Deleted** — Allow un-deleting with a restore reason (optional per DocType config).

---

## Acceptance Criteria

- [ ] A new document is created with `status = initial_status` from DocType config.
- [ ] Attempting to update a `Locked` document returns 422 with a descriptive error.
- [ ] `canPerform('update', doc, user)` returns `false` when `doc.status = 'Locked'`.
- [ ] Submitting a DocType with `lock_on_submit = true` transitions status to `Submitted` and makes listed `lock_fields_after_submit` fields read-only.
- [ ] Cancelling a Submitted document requires a `cancel_reason` when `LIFECYCLE_REQUIRE_CANCEL_REASON = true`.
- [ ] Amending creates a new Draft document with `amended_from = original.id` and cancels the original.
- [ ] Deleting a document sets `status = Deleted`, `deleted_at`, `deleted_by` — no row is removed from the DB.
- [ ] List queries never return documents with `status = Deleted`.
- [ ] `GET /api/v1/doc/{DocType}/{id}/lifecycle` returns the correct allowed/blocked actions for the current user.
- [ ] Status badge colors are correct per status in both Dynamic List and Dynamic Form.
- [ ] `is_deleted` column does not exist in any newly created `dt_*` table.
- [ ] `is_locked` column does not exist in any newly created `dt_*` table.

---

## Notes

- **Status vs. Workflow State**: These are two separate things. `status` is the document's lifecycle position (Draft, Submitted, Locked, etc.). `workflow_state` is where the document is in a user-defined approval process (e.g., Pending Manager Review). Both can coexist on the same document.

## System Lifecycle vs Custom Workflows

Berdasarkan arsitektur Framee, terdapat pemisahan tegas antara **Lifecycle Status** (Internal Sistem) dan **Workflow State** (Alur Bisnis Kustom):

1. **System Lifecycle (`status`)**:
   - Merupakan field wajib bawaan sistem (contoh nilai: `Draft`, `Active`, `Submitted`, `Locked`, `Cancelled`, `Deleted`).
   - Bertujuan sebagai pengunci keamanan data level Core (contoh: CRUD Engine akan menolak edit jika status adalah `Locked`).
   
2. **Custom Workflows (`workflow_state`)**:
   - Merupakan alur persetujuan dinamis yang **bisa berbeda untuk setiap DocType**.
   - Setiap DocType dapat dikonfigurasi memiliki Workflow masing-masing.
   - Perubahan pada `workflow_state` secara otomatis dapat memicu perubahan pada system `status` (misal: Saat `workflow_state` menjadi "Approved", sistem akan mengeset `status` menjadi `Locked`).
   - Untuk mengaktifkan ini, DocType akan memiliki kolom tambahan `workflow_state` yang menjadi penunjuk (pointer) ke Master Workflow.- **Audit Integrity**: The immutability guarantee is the point. A posted invoice with `status = Locked` guarantees to any auditor that the values in that row are exactly what was posted. This is not possible with `is_locked = 1` that an admin could flip at will.
- **No `is_deleted`**: This is a permanent architectural decision. Any plugin or code that uses `is_deleted` is non-compliant. All status checks must go through `canPerform()` or a status field check.
- **Amendment is the "edit" for locked documents**: The framework intentionally provides no "unlock and edit" escape hatch. The correct pattern is always: Cancel → Amend → new Draft. This keeps the audit trail unbroken.
