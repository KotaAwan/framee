# 01-08 Workflow Engine

## Purpose

The Workflow Engine enables **configurable, multi-step approval and state transition processes** for any DocType in Framee. It allows business processes — such as purchase approval, leave requests, invoice submission, and document review cycles — to be defined as metadata-driven workflows without writing custom code.

It exists because ERP systems fundamentally involve human decision-making processes: someone creates a document, someone reviews it, someone approves or rejects it. The Workflow Engine makes these processes configurable, auditable, and enforceable.

---

## Goals

1. Enable any DocType marked as `is_submittable` to have a configurable workflow attached.
2. Allow administrators to define workflow states and transitions in the admin UI without writing code.
3. Enforce that users can only move a document to states permitted by their role.
4. Send notifications (via the Event Engine) on state transitions for downstream handlers to act on.
5. Maintain a complete, auditable history of all workflow transitions per document.
6. Support both linear (sequential) and branching (conditional) workflows.
7. Support rejection and return-to-sender flows.

---

## Scope

### In Scope
- Workflow definition management (states, transitions, roles)
- Attaching workflows to DocTypes
- Enforcing state-based transitions on document submissions and cancellations
- Role-based transition authorization
- Workflow history tracking per document
- Event emission on each state transition
- Status field auto-update on the document when workflow state changes
- Support for optional comments on state transitions
- Notification hooks on transition (recipients configured per transition)

### Out of Scope
- Email/SMS sending (delivered by a Notification plugin that listens to workflow events)
- Automated/scheduled state transitions (future Scheduler Engine)
- Complex branching with code-based conditions (conditions are metadata-defined, not code)
- Process mining or workflow analytics (future Reporting module)

---

## Functional Requirements

### FR-001 Workflow Definition
- An administrator must be able to create a workflow with a name, target DocType, and a list of states and transitions.
- Only one workflow can be active per DocType at a time.

### FR-002 State Definition
- Each state must have a `name`, `label`, `style` (for color coding), and a `document_status` mapping (Draft, Pending, Approved, Rejected, Cancelled).
- Each DocType with an active workflow must have a `workflow_state` field that stores the current state name.
- States are terminal (no outgoing transitions) or intermediate (have at least one outgoing transition).

### FR-003 Transition Definition
- Each transition must define:
  - `from_state`: starting state
  - `to_state`: target state
  - `action`: button label shown to the user (e.g., "Approve", "Reject", "Submit for Review")
  - `allowed_roles`: list of roles authorized to execute this transition
  - `require_comment`: whether a comment is mandatory before transitioning
  - `condition_field` / `condition_value`: optional condition that must be true on the document

### FR-004 Transition Enforcement
- When a user attempts to submit, cancel, or change a workflow state, the Workflow Engine validates:
  1. The document is in the expected `from_state`.
  2. The user's role is in the transition's `allowed_roles`.
  3. Any `condition_field` / `condition_value` constraint is satisfied.
  4. A comment is provided if `require_comment = true`.
- Failure at any step returns an appropriate error.

### FR-005 Workflow History
- Every successful state transition is recorded in `sys_workflow_history`.
- History includes: document ID, DocType, from state, to state, user, timestamp, comment.

### FR-006 Event Emission on Transition
- On every successful transition, the Workflow Engine emits `{doctype}.workflow.{action}` event.
- This allows notification plugins and business logic plugins to react to workflow events.

### FR-007 Read-Only Enforcement
- Documents in a terminal state (Approved, Rejected) or in the Submitted document status are read-only.
- Only a `cancel` transition can unlock a submitted document for editing.

---

## Architecture

```
User Action: "Approve Purchase Order"
                   │
                   ▼
┌──────────────────────────────────────────────────────────────┐
│                    Workflow Engine                            │
│                                                              │
│  1. Load workflow for DocType via Metadata Engine            │
│  2. Find matching transition (from_state + action)           │
│  3. Check user role is in allowed_roles                      │
│  4. Evaluate condition_field / condition_value               │
│  5. Check require_comment is satisfied                       │
│  6. Execute transition:                                      │
│     a. Update document workflow_state field                  │
│     b. Update document docstatus if applicable              │
│     c. Write to sys_workflow_history                         │
│     d. Emit {doctype}.workflow.{action} event                │
│  7. Return updated document                                  │
└──────────────────────────────────────────────────────────────┘
```

### Document Status Mapping

| Workflow Document Status | `docstatus` Value | Meaning |
|--------------------------|-------------------|---------|
| Draft | 0 | Editable, not submitted |
| Pending | 0 | Editable, awaiting action |
| Approved | 1 | Submitted/approved, read-only |
| Rejected | 2 | Rejected, read-only |
| Cancelled | 2 | Cancelled, read-only |

---

## Database Design

### `sys_workflow` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | VARCHAR(36) | UUID PK |
| `tenant_id` | VARCHAR(36) | Tenant reference |
| `name` | VARCHAR(100) | Unique workflow name per tenant |
| `label` | VARCHAR(150) | Display name |
| `doctype` | VARCHAR(100) | Target DocType name |
| `initial_state` | VARCHAR(100) | Starting state for new documents |
| `is_active` | TINYINT(1) | Enable/disable workflow |
| `created_at` | DATETIME | Timestamp |
| `updated_at` | DATETIME | Timestamp |
| `is_deleted` | TINYINT(1) | Soft delete |

### `sys_workflow_state` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | VARCHAR(36) | UUID PK |
| `tenant_id` | VARCHAR(36) | Tenant reference |
| `workflow_id` | VARCHAR(36) | FK → sys_workflow.id |
| `name` | VARCHAR(100) | State identifier (snake_case) |
| `label` | VARCHAR(150) | Display label |
| `document_status` | VARCHAR(20) | Draft / Pending / Approved / Rejected / Cancelled |
| `style` | VARCHAR(20) | Color: default / success / warning / danger / info |
| `is_terminal` | TINYINT(1) | No outgoing transitions allowed |
| `sort_order` | INT | Display order |

### `sys_workflow_transition` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | VARCHAR(36) | UUID PK |
| `tenant_id` | VARCHAR(36) | Tenant reference |
| `workflow_id` | VARCHAR(36) | FK → sys_workflow.id |
| `from_state` | VARCHAR(100) | Source state name |
| `to_state` | VARCHAR(100) | Target state name |
| `action` | VARCHAR(100) | Action label (e.g., "Approve") |
| `action_key` | VARCHAR(100) | Programmatic action key (snake_case) |
| `allowed_roles` | JSON | Array of role names permitted |
| `require_comment` | TINYINT(1) | Mandatory comment on transition |
| `condition_field` | VARCHAR(100) | Field to check for conditional transition |
| `condition_value` | VARCHAR(255) | Required value for conditional transition |
| `sort_order` | INT | Display order of action buttons |

### `sys_workflow_history` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | VARCHAR(36) | UUID PK |
| `tenant_id` | VARCHAR(36) | Tenant reference |
| `doctype` | VARCHAR(100) | DocType name |
| `doc_id` | VARCHAR(36) | Document UUID |
| `workflow_id` | VARCHAR(36) | FK → sys_workflow.id |
| `from_state` | VARCHAR(100) | Previous state |
| `to_state` | VARCHAR(100) | New state |
| `action` | VARCHAR(100) | Transition action label |
| `user_id` | VARCHAR(36) | User who performed transition |
| `comment` | TEXT | Optional comment |
| `created_at` | DATETIME | Transition timestamp |

### Indexes

```sql
-- sys_workflow
UNIQUE INDEX idx_wf_doctype (tenant_id, doctype, is_active)
INDEX idx_wf_tenant (tenant_id, is_deleted)

-- sys_workflow_state
INDEX idx_wfstate_workflow (workflow_id)
UNIQUE INDEX idx_wfstate_name (workflow_id, name)

-- sys_workflow_transition
INDEX idx_wftrans_workflow (workflow_id)
INDEX idx_wftrans_from_state (workflow_id, from_state)

-- sys_workflow_history
INDEX idx_wfhist_doc (tenant_id, doctype, doc_id)
INDEX idx_wfhist_user (tenant_id, user_id)
INDEX idx_wfhist_created (tenant_id, created_at)
```

---

## API Design

### Workflow Management (Admin)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/workflow` | List all workflows |
| `POST` | `/api/v1/workflow` | Create a workflow |
| `GET` | `/api/v1/workflow/:id` | Get workflow with states and transitions |
| `PUT` | `/api/v1/workflow/:id` | Update workflow |
| `DELETE` | `/api/v1/workflow/:id` | Soft delete workflow |

### Document Workflow Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/doc/:doctype/:id/workflow` | Get current workflow state + available transitions |
| `POST` | `/api/v1/doc/:doctype/:id/workflow/transition` | Execute a workflow transition |
| `GET` | `/api/v1/doc/:doctype/:id/workflow/history` | Get workflow history for document |

#### Example — `GET /api/v1/doc/PurchaseOrder/ord-123/workflow`

```json
{
  "success": true,
  "data": {
    "current_state": "Pending Review",
    "document_status": "Pending",
    "available_transitions": [
      {
        "action": "Approve",
        "action_key": "approve",
        "to_state": "Approved",
        "require_comment": false
      },
      {
        "action": "Reject",
        "action_key": "reject",
        "to_state": "Rejected",
        "require_comment": true
      }
    ]
  }
}
```

#### Example — `POST /api/v1/doc/PurchaseOrder/ord-123/workflow/transition`

**Request:**
```json
{
  "action_key": "approve",
  "comment": "Approved for Q3 budget allocation."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "doc_id": "ord-123",
    "from_state": "Pending Review",
    "to_state": "Approved",
    "document_status": "Approved",
    "transitioned_by": "user-uuid",
    "transitioned_at": "2026-07-13T09:00:00Z"
  }
}
```

---

## UI Behaviour

### Workflow State Display
- The document form displays the current workflow state as a badge with the configured color style.
- A timeline section shows the full transition history with user, timestamp, and comment.

### Transition Buttons
- Available transitions are rendered as action buttons in the form toolbar.
- Buttons are only shown for transitions the current user's role is permitted to execute.
- If a transition requires a comment, clicking the button opens a confirmation modal with a comment textarea.

### Visual Workflow Diagram
- The Workflow admin form displays a simple visual representation of the state machine (states as nodes, transitions as arrows).
- This is a read-only diagram for reference — editing is done via the state/transition tables.

---

## Configuration

| Config Key | Default | Description |
|------------|---------|-------------|
| `WORKFLOW_HISTORY_ENABLED` | `true` | Record transition history |
| `WORKFLOW_NOTIFY_ON_TRANSITION` | `true` | Emit events on state transitions |
| `WORKFLOW_REQUIRE_COMMENT_DEFAULT` | `false` | Default require_comment for new transitions |
| `WORKFLOW_MAX_STATES` | `20` | Maximum states per workflow |
| `WORKFLOW_MAX_TRANSITIONS` | `50` | Maximum transitions per workflow |

---

## Validation Rules

- A DocType can have at most one active workflow at a time. Activating a new workflow deactivates the previous one.
- A workflow must have exactly one `initial_state`. No zero, no two.
- A terminal state must have no outgoing transitions.
- A non-terminal state must have at least one outgoing transition.
- `from_state` and `to_state` in a transition must both be valid states within the same workflow.
- `allowed_roles` must not be empty — a transition with no allowed roles is unreachable and is rejected.
- If a document's workflow is changed mid-process, all documents in non-terminal states must be reviewed manually (the engine does not auto-migrate states).

---

## Security

- Transition execution checks the requesting user's roles against the transition's `allowed_roles`.
- Users cannot self-approve documents they created if the workflow design prevents self-approval (configurable via role design).
- Workflow history is immutable — no updates or deletes permitted.
- Admin-only routes for workflow management require System Manager or Module Manager role.
- Conditional permission on transitions prevents unauthorized access to actions even if the user has the right role.

---

## Events

### Emitted Events

| Event | Payload | Trigger |
|-------|---------|---------|
| `{doctype}.workflow.{action_key}` | `{ doc_id, from_state, to_state, user_id, comment }` | Any successful transition |
| `{doctype}.workflow.approved` | Same | Transition to an Approved terminal state |
| `{doctype}.workflow.rejected` | Same | Transition to a Rejected terminal state |
| `{doctype}.workflow.cancelled` | Same | Cancellation transition |
| `workflow.definition_changed` | `{ workflow_id, doctype }` | Workflow config updated |

### Listened Events

| Event | Action |
|-------|--------|
| `plugin.registered` | Register any plugin-defined workflow templates |
| `workflow.definition_changed` | Invalidate cached workflow metadata for the affected DocType |

---

## Performance

### Metadata Caching
- Workflow definitions (states and transitions) are cached in Redis by the Metadata Engine alongside DocType metadata.
- Cache key: `framee:meta:{tenant_id}:workflow:{doctype}`.
- Cache is invalidated when the workflow is updated.

### Transition Check Efficiency
- Transition validation (role check, condition check) operates entirely on in-memory data from the cache.
- No additional database query is required for a standard transition execution beyond the document update and history insert.

### History Table
- History inserts are non-blocking (async, after-transition).
- History table is pruned by a scheduled job if configured to retain only N months of data.

---

## Future Improvements

- **Visual Workflow Designer** — Drag-and-drop UI for building state machines visually.
- **Parallel Approvals** — Multiple users must approve before a document advances (consensus workflows).
- **Escalation Rules** — Auto-escalate to a higher approver if no action is taken within a time window.
- **SLA Tracking** — Track time spent in each state and alert when SLAs are breached.
- **Conditional Branching (Expression-Based)** — More complex conditions using a safe expression evaluator (not arbitrary code).
- **Automated Transitions** — Time-based or event-triggered auto-transitions (e.g., auto-approve after 3 days).

---

## Acceptance Criteria

- [ ] A workflow with 3 states (Draft → Pending Review → Approved) and 2 transitions can be created via the admin UI.
- [ ] A document created under this workflow starts in the `initial_state` automatically.
- [ ] A user with the Reviewer role can transition from Draft to Pending Review; a user without this role receives 403.
- [ ] Approver role can transition from Pending Review to Approved; others receive 403.
- [ ] Transitioning to Approved sets the document to read-only.
- [ ] A required comment that is empty on a `require_comment = true` transition returns a validation error.
- [ ] Every successful transition creates a `sys_workflow_history` record with from_state, to_state, user, and timestamp.
- [ ] After transition, `{doctype}.workflow.{action_key}` event is emitted with the correct payload.
- [ ] `GET /api/v1/doc/:doctype/:id/workflow` shows only transitions the current user is authorized to execute.
- [ ] The workflow state badge on the document form updates correctly after each transition.
- [ ] Deactivating a workflow removes transition buttons from the document form.
- [ ] `GET /api/v1/doc/:doctype/:id/workflow/history` returns the complete transition history in chronological order.

---

## Notes

- The Workflow Engine is intentionally simple for the initial release. It covers the 80% of ERP workflow needs: linear and simple branching approval flows. Complex parallel workflows (multiple simultaneous approvers, voting mechanisms) are deferred to a future enhancement.
- Workflow state is stored on the document itself (in the `workflow_state` field and `docstatus` field). This means the state is always co-located with the data — no join is needed to determine a document's workflow status.
- Plugin authors who need to react to workflow events should subscribe to `{DocType}.workflow.{action_key}` events via the Event Engine — not by hooking into the Workflow Engine internals.
- The term "submittable" in Framee refers specifically to DocTypes that have a formal submission process (invoices, purchase orders, leave requests). Not every DocType needs a workflow.
