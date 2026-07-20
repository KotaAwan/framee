# 01-03 CRUD Engine

## Purpose

The CRUD Engine is Framee's **universal data operation layer**. It provides the standardized Create, Read, Update, and Delete operations that apply to every DocType in the system — without requiring a developer to write a custom controller or service for each one.

Its purpose is to translate metadata definitions into safe, validated, permission-checked, event-emitting data operations. By centralizing all data mutations through this engine, Framee ensures that audit trails, permission enforcement, event emissions, and validation rules are never accidentally bypassed.

---

## Goals

1. Provide a single, reusable CRUD interface for all DocType records.
2. Enforce DocField-driven validation rules on every create and update operation.
3. Enforce permission checks before executing any read, write, or delete operation.
4. Emit lifecycle events for every operation so plugins and modules can react.
5. Delegate audit trail recording to the Audit Engine via events.
6. Enforce document lifecycle rules (Draft → Submitted → Locked) before any write.
7. Handle document versioning for DocTypes that opt into change tracking.

---

## Scope

### In Scope
- Create, Read, Update, Delete, List, and Submit operations for any registered DocType
- Input validation derived from DocField metadata (required, type, max length, options)
- Permission enforcement before every operation (delegates to Permission Engine)
- Before/After lifecycle hooks for each operation
- Audit trail recording on every write operation
- Soft delete and restore operations
- Document submission and cancellation (for submittable DocTypes)
- Duplicate detection based on DocType-configured unique fields

### Out of Scope
- Custom business logic for specific DocTypes (belongs in plugin hooks or service layer)
- Reporting and aggregation queries (belongs in a dedicated Report Engine, future)
- Bulk import/export operations (belongs in a dedicated Import Engine, future)
- Schema migrations (belongs in the Database Engine)

---

## Functional Requirements

### FR-001 Generic CRUD for Any DocType
- Given a valid DocType name and tenant context, the CRUD Engine must perform create, read, update, delete, and list operations without any DocType-specific code.

### FR-002 Metadata-Driven Validation
- On every `create` and `update`, the engine must validate all field values against their DocField definitions: required check, type check, options check (for Select fields), and Link integrity check (for Link fields).
- **Hidden fields are excluded from required validation.** Fields with `is_hidden = 1` are skipped even if `is_required = 1`. This prevents false validation errors for system-generated fields (e.g., `code`, `google_id`, `pin_hash`) that are hidden from the user form but populated by the engine.
- **Duplicate key detection:** When the database returns error code `ER_DUP_ENTRY` (MySQL 1062), the engine parses the error message to identify the violated unique key, matches it to the corresponding DocField label, and re-throws it as a user-readable `ValidationError` instead of a raw 500 error.

### FR-003 Permission Enforcement
- Every operation must check permissions via the Permission Engine before execution.
- If the user lacks permission, the operation must fail with a 403 error — never silently skip the check.

### FR-004 Lifecycle Events
- Every operation must emit the corresponding before and after events:
  - `{doctype}.before_insert` / `{doctype}.after_insert`
  - `{doctype}.before_update` / `{doctype}.after_update`
  - `{doctype}.before_delete` / `{doctype}.after_delete`
  - `{doctype}.before_submit` / `{doctype}.after_submit`
- Before events may cancel the operation by throwing an error.

### FR-005 Audit Trail (Two-Tier Logging)
- Every successful write operation (create, update, delete) writes **directly to `{table_name}_logs`** (local log) inside the same database transaction as the primary record insert/update. This is a synchronous write — not async.
- The `{table_name}_logs` entry stores: `doc_id`, `status` (e.g., `'Created'`), `content` (record name or null), `created_by`, `created_at`.
- The `sys_docfield` table is excluded from local log writes to avoid circular meta-logging.
- Global compliance audit (`sys_audit_log`) is handled separately by the Audit Engine via event subscription.

### FR-005b Auto-Save Log Suppression
- When the Workflow Engine executes a transition triggered by the CRUD save flow with `comment = 'Auto-saved'` or `comment = 'Auto-updated'`, that transition is **not** written to `{table_name}_logs`.
- This prevents the Activity Timeline from showing redundant "Auto-saved" entries alongside the real "Created" entry that the CRUD Engine already wrote.

### FR-006 Document Lifecycle Gate
- Before executing any write, update, delete, or submit, the CRUD Engine must invoke `DocumentLifecycleEngine.canPerform(doctype, docId, action, user)` and abort with 403/409 if the gate returns false.
- This gate checks: Permission → Workflow State → Document Status → Field Permission.
- The gate is **non-optional** and cannot be bypassed by plugins.

### FR-007 Status-Based Delete
- `delete` operations must set `status = 'Deleted'`, `deleted_at`, `deleted_by`, and `delete_reason`.
- Hard physical delete is only available via an explicit system-level purge restricted to System Manager role.
- A `restore` operation transitions status back to `Draft` (subject to DocType config).

### FR-008b Document Submission & Cancellation
- For DocTypes with `is_submittable = true`, the `submit` operation sets `status = 'Submitted'` and locks the document.
- A `cancel` operation sets `status = 'Cancelled'` with reason; it does not delete data.
- An `amend` operation clones the document to a new record with `amended_from` populated, and the new record starts as `Draft`.

### FR-008c Code Generation via NamingEngine
- On every `insert`, the CRUD Engine delegates code generation to `NamingEngine.generateCode(meta, data, tableName)`.
- The generated `code` is included in the record payload before the DB insert.
- If `auto_code` is not set, the NamingEngine defaults to UUID generation.
- See `NamingEngine` docs for all supported patterns.

### FR-008d Child Table Logging
- When a parent record is inserted with child table data (Table-type fields), each child row insertion also writes a corresponding log entry to `{child_table_name}_logs` within the same transaction.

### FR-008 List with Filters, Sort, and Pagination
- The list operation must support field-based filtering, multi-field sorting, and cursor/offset pagination.
- Filter fields and sort options must be limited to fields where the user has read permission.

---

## Architecture

```
                 Incoming Request (DocType, action, data)
                              │
                              ▼
                 ┌──────────────────────────┐
                 │      CRUD Engine         │
                 │                          │
                 │  1. Load Metadata        │ ← Metadata Engine
                 │  2. Check Permission     │ ← Permission Engine
                 │  3. Lifecycle Gate       │ ← Document Lifecycle Engine
                 │  4. Validate Input       │
                 │  5. Emit Before Event    │ ← Event Engine
                 │  6. Execute DB Operation │ ← Database Engine
                 │  7. Emit After Event     │ ← Event Engine
                 │     └─ Audit Engine      │   (async subscriber)
                 │     └─ Version Engine    │   (async subscriber)
                 │  8. Return Result        │
                 └─────────────────────────┘
```

### Operation Flow

| Step | Description | Failure Behavior |
|------|-------------|-----------------|
| 1. Load Metadata | Fetch DocType schema from Metadata Engine | Abort: 404 DocType not found |
| 2. Check Permission | Verify user role has required action | Abort: 403 Forbidden |
| 3. Lifecycle Gate | Call `canPerform()` — checks document `status` and allowed transitions | Abort: 409 Operation not allowed on current status |
| 4. Validate Input | Validate fields against DocField rules | Abort: 422 Validation Error |
| 5. Emit Before Event | Allow hooks to cancel or modify data | Abort if hook throws |
| 6. Execute DB Operation | Run insert/update/select/delete (inside transaction) | Abort: 500 DB Error, transaction rolled back |
| 6a. Write Local Log | Write to `{table}_logs` inside the same transaction | Rolled back with record if DB error |
| 6b. Parse DB Error | Catch `ER_DUP_ENTRY` → convert to `ValidationError` with field label | Returns 422 instead of 500 |
| 7. Emit After Event | Notify listeners (Audit Engine async) | Non-fatal: log failure, continue |
| 8. Return Result | Return formatted response | — |

> **Note:** Local log (`{table}_logs`) is written **synchronously inside the same transaction** as the record. Global audit log (`sys_audit_log`) is written **asynchronously** by the Audit Engine as an event subscriber.

---

## Database Design

> The CRUD Engine does **not** own `sys_audit_log`. Audit storage is the responsibility of the **Audit Engine** (`01-10`). See that PRD for the full schema.

### Common Column Contract (All `dt_*` Tables)

All document tables managed by the CRUD Engine must include the following status lifecycle columns:

```sql
id              VARCHAR(36)   NOT NULL PRIMARY KEY        -- UUID
tenant_id       VARCHAR(36)   NOT NULL
status          VARCHAR(20)   NOT NULL DEFAULT 'Draft'    -- lifecycle status
created_by      VARCHAR(36)   NULL
updated_by      VARCHAR(36)   NULL
created_at      DATETIME      DEFAULT CURRENT_TIMESTAMP
updated_at      DATETIME      ON UPDATE CURRENT_TIMESTAMP
deleted_at      DATETIME      NULL
deleted_by      VARCHAR(36)   NULL
delete_reason   TEXT          NULL
amended_from    VARCHAR(36)   NULL                        -- FK to original doc
submitted_at    DATETIME      NULL
submitted_by    VARCHAR(36)   NULL
cancelled_at    DATETIME      NULL
cancelled_by    VARCHAR(36)   NULL
cancel_reason   TEXT          NULL
```

> `is_deleted` and `is_locked` columns are **retired**. The `status` field is the single source of truth.

### Dynamic DocType Tables

For each DocType, its data is stored in a table named by convention. Two strategies:

| Strategy | Description |
|----------|-------------|
| **Single Table** | All records for a DocType in `dt_{doctype_name_snake}` |
| **EAV Hybrid** | Metadata-defined typed columns in a dedicated table (preferred) |

Framee uses the **dedicated table per DocType** strategy (not EAV). Each DocType has its own MySQL table auto-created by the DocType service when the DocType is activated.

---

## API Design

The CRUD Engine exposes operations via the API Engine's auto-generated routes. All routes follow the pattern:

| Method | Endpoint | Operation |
|--------|----------|-----------|
| `GET` | `/api/v1/doc/:doctype` | List records |
| `POST` | `/api/v1/doc/:doctype` | Create record |
| `GET` | `/api/v1/doc/:doctype/:id` | Get single record |
| `PUT` | `/api/v1/doc/:doctype/:id` | Update record |
| `DELETE` | `/api/v1/doc/:doctype/:id` | Set `status = 'Deleted'` (soft delete) |
| `POST` | `/api/v1/doc/:doctype/:id/submit` | Submit → `status = 'Submitted'` |
| `POST` | `/api/v1/doc/:doctype/:id/cancel` | Cancel → `status = 'Cancelled'` |
| `POST` | `/api/v1/doc/:doctype/:id/amend` | Clone document, set `amended_from` |
| `POST` | `/api/v1/doc/:doctype/:id/restore` | Restore → `status = 'Draft'` |

#### Example — `POST /api/v1/doc/Customer` (Create)

**Request:**
```json
{
  "customer_name": "PT. Maju Jaya",
  "customer_type": "Company",
  "phone": "021-123456"
}
```

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "id": "uuid-...",
    "customer_name": "PT. Maju Jaya",
    "customer_type": "Company",
    "phone": "021-123456",
    "created_at": "2026-07-13T00:00:00Z",
    "created_by": "user-uuid"
  }
}
```

**Response (Validation Error):**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "fields": {
      "customer_name": "Customer Name is required.",
      "customer_type": "Invalid option. Allowed: Company, Individual, Government."
    }
  }
}
```

#### Example — `GET /api/v1/doc/Customer?page=1&pageSize=20&filters[customer_type]=Company&sort=customer_name:asc`

**Response:**
```json
{
  "success": true,
  "data": [...],
  "meta": {
    "total": 145,
    "page": 1,
    "pageSize": 20,
    "totalPages": 8
  }
}
```

---

## UI Behaviour

The CRUD Engine is consumed by the Dynamic Form and Dynamic List components:

- **Dynamic Form** sends `POST` (create) and `PUT` (update) to the CRUD Engine endpoints.
- **Dynamic List** sends `GET` (list) with filter, sort, and pagination parameters.
- **Submit Button** appears on the form for submittable DocTypes and calls the `/submit` endpoint.
- **Delete Button** calls the `DELETE` endpoint, which performs soft delete.
- Validation errors returned by the CRUD Engine are mapped back to individual form fields and displayed inline.

---

## Configuration

| Config Key | Default | Description |
|------------|---------|-------------|
| `CRUD_AUDIT_ENABLED` | `true` | Enable audit trail logging |
| `CRUD_MAX_LIST_SIZE` | `200` | Maximum records returnable per list call |
| `CRUD_DEFAULT_PAGE_SIZE` | `20` | Default pagination size |
| `CRUD_ALLOW_HARD_DELETE` | `false` | Allow hard delete (System Manager only) |
| `CRUD_TRACK_CHANGES_ALL` | `false` | Force audit trail on all DocTypes regardless of setting |

---

## Validation Rules

### Field-Level Validation (Derived from DocField Metadata)

| Rule | DocField Config | Error |
|------|----------------|-------|
| Required | `is_required = 1` | `{label} is required.` |
| Type: Data | `fieldtype = Data` | Must be a string |
| Type: Int | `fieldtype = Int` | Must be a whole number |
| Type: Float | `fieldtype = Float` | Must be a decimal number |
| Type: Currency | `fieldtype = Currency` | Must be a positive decimal |
| Type: Date | `fieldtype = Date` | Must be a valid date (YYYY-MM-DD) |
| Type: Datetime | `fieldtype = Datetime` | Must be a valid datetime (ISO 8601) |
| Type: Select | `fieldtype = Select` | Must match one of `options` values |
| Type: Link | `fieldtype = Link` | Linked record must exist in referenced DocType |
| Max Length | `max_length` | String length must not exceed limit |
| Read Only | `is_read_only = 1` | Field is ignored on write (not rejected) |

### Document-Level Validation

- Only one record per DocType can have the same value for a field marked as `is_unique`.
- Submitted documents cannot be updated. Any update attempt returns a 409 Conflict.
- A document in a workflow that requires a specific role for transition cannot be moved by a user without that role.
- **Duplicate key violations (MySQL `ER_DUP_ENTRY` / errno 1062)** are caught and converted to `ValidationError` with human-readable message: e.g., `"Email 'john@example.com' is already registered and must be unique."`. The engine matches the constraint name to the DocField label using naming conventions: `{table_name}_{fieldname}_unique` or `{fieldname}_unique`.
- **Hidden fields (`is_hidden = 1`) are excluded from required validation**, even if `is_required = 1`. This is critical for system-managed fields like `code` (generated by NamingEngine), `google_id`, and `pin_hash`.

---

## Security

- Every CRUD operation checks permissions via the Permission Engine before execution.
- Field-level read permissions are enforced when serializing responses — hidden fields are stripped.
- Field-level write permissions are enforced on create/update — write-protected fields are ignored.
- `tenant_id` is injected from the JWT context, never from the request payload.
- Audit logs are immutable — they cannot be updated or soft-deleted by any user.
- Hard delete requires `System Manager` role and is logged as a special audit action.

---

## Events

### Emitted Events (Per DocType)

| Event | Trigger |
|-------|---------|
| `{doctype}.before_insert` | Before record is created |
| `{doctype}.after_insert` | After record is created successfully |
| `{doctype}.before_update` | Before record is updated |
| `{doctype}.after_update` | After record is updated successfully |
| `{doctype}.before_delete` | Before record is soft-deleted |
| `{doctype}.after_delete` | After record is soft-deleted |
| `{doctype}.before_submit` | Before document is submitted |
| `{doctype}.after_submit` | After document is submitted |
| `{doctype}.before_cancel` | Before submitted document is cancelled |
| `{doctype}.after_cancel` | After document is cancelled |

### Emitted System Events

| Event | Trigger |
|-------|---------|
| `crud.validation_failed` | Input validation failed |
| `crud.permission_denied` | Permission check failed |

### Listened Events

_The CRUD Engine does not subscribe to external events. It emits events and is the target of external hooks (plugins subscribe to its events)._

---

## Performance

### Query Optimization
- List queries use specific `SELECT` field lists derived from `in_list_view` field metadata rather than `SELECT *`.
- `WHERE tenant_id = ? AND is_deleted = 0` is always the primary filter, benefiting from the mandatory composite index.
- Filter and sort expressions are validated against DocField metadata to prevent injection of arbitrary column names.

### Audit Log Performance
- Audit log writes are asynchronous and do not block the API response. They are queued and written after the response is sent.
- If the audit queue is full or Redis is unavailable, audit log failures are logged as errors but do not fail the primary operation.

### Pagination
- Default page size of 20 prevents large unbounded queries.
- Cursor-based pagination is supported as an alternative to offset pagination for high-volume datasets.

---

## Future Improvements

- **Bulk Create/Update** — Process arrays of records in a single transactional request.
- **Optimistic Locking** — Detect and prevent lost updates using a `version` field on records.
- **Field-Level Change Tracking** — Store per-field change history for complete audit granularity.
- **Draft Mode** — Save a document as a draft (not yet validated/submitted) before finalization.
- **CRUD Hooks as Metadata** — Allow before/after hooks to be configured in metadata rather than code.
- **Computed Fields** — Fields whose values are auto-calculated from other fields, defined in metadata.

---

## Acceptance Criteria

- [ ] `POST /api/v1/doc/Customer` creates a record and returns the full record including auto-generated `id` and `created_at`.
- [ ] `POST /api/v1/doc/Customer` with a missing required field returns 422 with a field-specific error message.
- [ ] `POST /api/v1/doc/Customer` with an invalid Select option returns 422 with the allowed options listed.
- [ ] `GET /api/v1/doc/Customer` returns only records belonging to the current tenant.
- [ ] `GET /api/v1/doc/Customer?filters[customer_type]=Company` returns only Company-type customers.
- [ ] `PUT /api/v1/doc/Customer/:id` updates only the provided fields; other fields remain unchanged.
- [ ] `DELETE /api/v1/doc/Customer/:id` sets `is_deleted = 1` and does not physically remove the record.
- [ ] After `DELETE`, the record does not appear in the standard list or get query.
- [ ] All write operations produce a row in `sys_audit_log` with correct user, action, and diff.
- [ ] `{doctype}.before_insert` and `{doctype}.after_insert` events are emitted on every successful create.
- [ ] A user without `write` permission receives 403 on any create, update, or delete attempt.
- [ ] A submitted document returns 409 Conflict on any update attempt.

---

## Notes

- The CRUD Engine deliberately has no knowledge of specific DocType business logic (e.g., "what to do when a Sales Order is submitted"). That logic belongs in plugin event handlers that subscribe to `SalesOrder.after_submit`.
- The term "document" in Framee refers to any single record instance of a DocType — not a file or PDF.
- Read-only fields (`is_read_only = 1`) are silently ignored on write, not rejected. This allows the same form payload to be submitted even if read-only values are included.
- The CRUD Engine is the most critical engine in Framee. Every data mutation passes through it. Changes to its behavior must be thoroughly tested and reviewed before merging.
