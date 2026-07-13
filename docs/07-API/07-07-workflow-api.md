# 07-07 Workflow API

## Purpose

Documents the API endpoints for Workflow operations — retrieving available transitions for a document and executing them.

---

## Base URL

`/api/v1/workflow`

---

## Endpoints

### GET `/api/v1/workflow/:doctype/:id/actions`

Returns the list of workflow actions (transitions) available to the current user for a specific document, based on its current `workflow_state` and the user's role.

**Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "current_state": "Draft",
    "actions": [
      {
        "action": "Request Approval",
        "state_from": "Draft",
        "state_to": "Pending Manager",
        "label": "Request Approval"
      }
    ]
  }
}
```

If the user has no permitted transitions (e.g., they are the wrong role, or the document is Locked), `actions` will be an empty array.

---

### POST `/api/v1/workflow/:doctype/:id/transition`

Executes a workflow transition for a document.

**Request Body:**
```json
{
  "action": "Request Approval",
  "comment": "Submitted for manager review."
}
```

**Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "id": "doc-uuid",
    "status": "Submitted",
    "workflow_state": "Pending Manager",
    "message": "Document moved to 'Pending Manager'."
  }
}
```

**Error Responses:**
- `403` — Current user's role is not permitted to execute this action.
- `409` — Document is not in the expected `state_from`. It may have been modified by another user.
- `400` — Action name is invalid or does not exist in the workflow configuration for this DocType.

---

### GET `/api/v1/workflow/:doctype/:id/history`

Returns the approval trail for a document — all workflow transitions that have occurred, in chronological order.

**Response `200 OK`:**
```json
{
  "success": true,
  "data": [
    {
      "id": "history-uuid-1",
      "action": "Request Approval",
      "state_from": "Draft",
      "state_to": "Pending Manager",
      "user_id": "user-uuid",
      "user_name": "Sutikno",
      "comment": "Submitted for manager review.",
      "created_at": "2026-07-13T09:00:00Z"
    },
    {
      "id": "history-uuid-2",
      "action": "Approve",
      "state_from": "Pending Manager",
      "state_to": "Approved",
      "user_id": "manager-uuid",
      "user_name": "Manager Budi",
      "comment": "Looks good. Approved.",
      "created_at": "2026-07-13T10:00:00Z"
    }
  ]
}
```
