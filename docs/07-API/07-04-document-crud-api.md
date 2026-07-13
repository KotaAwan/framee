# 07-04 Document CRUD API

## Purpose

Documents the generic CRUD API endpoints that operate on any DocType. Because Framee uses dynamic routing (see `04-07-dynamic-routing.md`), these endpoints work for all DocTypes without requiring custom route code.

---

## Base URL

`/api/v1/doc`

All endpoints require:
- `Authorization: Bearer <access_token>` header.
- `tenant_id` is derived from the JWT — never sent in the request body.

---

## Endpoints

### GET `/api/v1/doc/:doctype`

Returns a paginated list of documents for the given DocType.

**Query Parameters:**

| Parameter | Default | Description |
|-----------|---------|-------------|
| `page` | `1` | Page number |
| `pageSize` | `20` | Records per page (max: 200) |
| `sort` | `created_at:desc` | Sort by `{field}:{asc\|desc}` |
| `search` | — | Full-text search term |
| `filters[status]` | — | Filter by status (e.g., `?filters[status]=Draft`) |
| `filters[{field}]` | — | Filter by any field value |
| `fields` | — | Comma-separated fields to return |

**Response `200 OK`:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-1",
      "name": "CUST-0001",
      "customer_name": "PT. Maju Jaya",
      "status": "Active",
      "created_at": "2026-07-13T03:00:00Z"
    }
  ],
  "meta": {
    "total": 145,
    "page": 1,
    "pageSize": 20,
    "totalPages": 8
  }
}
```

---

### GET `/api/v1/doc/:doctype/:id`

Returns a single document by its ID.

**Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "id": "uuid-1",
    "name": "CUST-0001",
    "status": "Active",
    "customer_name": "PT. Maju Jaya",
    "customer_type": "Company",
    "version": 3,
    "created_at": "2026-07-13T03:00:00Z",
    "created_by_name": "Administrator"
  }
}
```

**Error Responses:**
- `404` — Document not found or deleted.
- `403` — No `can_read` permission.

---

### POST `/api/v1/doc/:doctype`

Creates a new document.

**Request Body:** All DocField values for the DocType. Standard columns (`id`, `tenant_id`, `status`, `created_at`, etc.) are auto-populated by the engine.

```json
{
  "customer_name": "PT. Baru Jaya",
  "customer_type": "Company"
}
```

**Response `201 Created`:**
```json
{
  "success": true,
  "data": {
    "id": "new-uuid",
    "name": "CUST-0003",
    "status": "Draft",
    "customer_name": "PT. Baru Jaya",
    "version": 1
  }
}
```

---

### PUT `/api/v1/doc/:doctype/:id`

Updates an existing document. The request body only needs to contain fields being changed.

**Request Body:**
```json
{
  "customer_name": "PT. Baru Jaya Updated",
  "version": 3
}
```

> The `version` field is **required** for optimistic locking. If the submitted version does not match the current DB version, the update is rejected with `409 Conflict`.

**Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "id": "uuid-1",
    "name": "CUST-0001",
    "customer_name": "PT. Baru Jaya Updated",
    "version": 4
  }
}
```

---

### DELETE `/api/v1/doc/:doctype/:id`

Soft-deletes a document (sets `status = 'Deleted'`, populates `deleted_at` and `deleted_by`).

**Request Body (optional):**
```json
{ "reason": "Duplicate entry" }
```

**Response `200 OK`:**
```json
{
  "success": true,
  "data": { "message": "Document deleted successfully." }
}
```

**Error Responses:**
- `409` — Document is Locked or Submitted. Cannot be deleted directly — cancel first.
- `403` — No `can_delete` permission.

---

### POST `/api/v1/doc/:doctype/:id/submit`

Submits a document (changes status from `Draft` to `Submitted`). Only valid for `is_submittable = true` DocTypes.

**Response `200 OK`:**
```json
{
  "success": true,
  "data": { "id": "uuid-1", "status": "Submitted", "submitted_at": "2026-07-13T10:00:00Z" }
}
```

---

### POST `/api/v1/doc/:doctype/:id/cancel`

Cancels a submitted document. Requires `can_cancel` permission.

**Request Body:**
```json
{ "reason": "Wrong customer entered." }
```

---

### POST `/api/v1/doc/:doctype/:id/amend`

Creates an amendment (a new editable clone) from a Locked document.

**Response `201 Created`:** Returns the new amendment document with `amended_from` pointing to the original.
