# 07-01 API Specification

## Purpose

Documents the standard contract for REST APIs in Framee. Since Framee uses dynamic API generation based on DocType, it is critical for the frontend and third-party integrations to have a consistent and predictable pattern.

---

## 1. General Principles

1. **Base URL**: All APIs are prefixed with `/api/v1/`.
2. **Content-Type**: All request bodies and responses use `application/json` (except Upload/Import which use `multipart/form-data`).
3. **Standard Response Format**:
   - Success: `{ "success": true, "data": ... }`
   - Error: `{ "success": false, "error": { "code": "...", "message": "..." } }`
4. **Authentication**: Header `Authorization: Bearer <jwt_token>`.
5. **Tenant Context**: Derived from the JWT token, does not need to be sent in the request body.

---

## 2. Standard CRUD Endpoints (Dynamic DocType API)

Every registered DocType automatically gets a set of endpoints under the `/api/v1/doc/{DocType}` route.

### A. List Records (GET)
Retrieves a list of records with support for pagination, filters, sorting, and search.

**Endpoint**: `GET /api/v1/doc/{DocType}`

**Query Parameters**:
- `page` (int): Page number (default: 1)
- `pageSize` (int): Number of records per page (default: 20)
- `search` (string): Full text search on fields configured as search_fields.
- `sort` (string): Format `field:asc` or `field:desc`.
- `filters[fieldname]` (string/array): Specific filters (example: `filters[status]=Draft`).
- `fields` (string): Comma separated list of fields to return (example: `name,status,customer_name`).

**Response**:
```json
{
  "success": true,
  "data": [ { ... }, { ... } ],
  "meta": {
    "total": 100,
    "page": 1,
    "pageSize": 20,
    "totalPages": 5
  }
}
```

### B. Get Single Record (GET)
Retrieves a single document by ID.

**Endpoint**: `GET /api/v1/doc/{DocType}/{id}`

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "CUST-0001",
    "customer_name": "PT. Maju",
    "status": "Draft",
    "version": 1
    ...
  }
}
```

### C. Create Record (POST)
Creates a new document.

**Endpoint**: `POST /api/v1/doc/{DocType}`

**Payload**:
```json
{
  "customer_name": "PT. Maju",
  "customer_type": "Company"
}
```
*(Note: `id`, `tenant_id`, `status`, and `created_at` are auto-generated, no need to send them)*

### D. Update Record (PUT)
Updates an existing document. Will fail if `status` is `Locked`, `Cancelled`, or `Deleted` (unless amend).

**Endpoint**: `PUT /api/v1/doc/{DocType}/{id}`

**Payload**:
```json
{
  "customer_type": "Individual",
  "version": 1 
}
```
*(Important: Must include `version` for Optimistic Locking. If the DB version is greater than the payload version, returns `409 Conflict`)*

### E. Delete / Soft Delete (DELETE)
Deletes a document. Standard behavior is **Soft Delete** (changes `status` to `Deleted`).

**Endpoint**: `DELETE /api/v1/doc/{DocType}/{id}`

---

## 3. Lifecycle & Workflow Actions (POST)

These operations change the document status without changing its contents.

| Action | Endpoint | Description |
|--------|----------|-------------|
| Submit | `POST /api/v1/doc/{DocType}/{id}/submit` | Draft -> Submitted |
| Lock | `POST /api/v1/doc/{DocType}/{id}/lock` | Submitted -> Locked |
| Unlock | `POST /api/v1/doc/{DocType}/{id}/unlock` | Locked -> Submitted |
| Cancel | `POST /api/v1/doc/{DocType}/{id}/cancel` | -> Cancelled |
| Amend | `POST /api/v1/doc/{DocType}/{id}/amend` | Clone cancelled/locked doc to a new Draft, set `amended_from` |

---

## 4. Bulk Actions

Operations on multiple documents at once.

### A. Bulk Delete
**Endpoint**: `POST /api/v1/doc/{DocType}/bulk-delete`
**Payload**:
```json
{
  "ids": ["id-1", "id-2"]
}
```

### B. Bulk Status Action
**Endpoint**: `POST /api/v1/doc/{DocType}/bulk-action`
**Payload**:
```json
{
  "action": "submit", 
  "ids": ["id-1", "id-2"]
}
```

---

## 5. Social & Engagement (Local Log)

**Endpoint**: `POST /api/v1/doc/{DocType}/{id}/comment`
**Payload**: `{ "text": "My comment" }`

**Endpoint**: `POST /api/v1/doc/{DocType}/{id}/like`
**Response**: `{ "success": true, "data": { "liked": true, "total": 5 } }`

**Endpoint**: `GET /api/v1/logs/{DocType}`
Retrieves timeline activity (comments, likes, status changes) at the DocType level.

**Endpoint**: `GET /api/v1/logs/{DocType}/{id}`
Retrieves timeline activity for a specific document.

---

## 6. Import & Export

### A. Export (GET)
**Endpoint**: `GET /api/v1/doc/{DocType}/export`
**Query Params**: Same as List Records, plus `format=csv` or `format=xlsx` or `format=pdf`.
**Response**: Generates a file download (Content-Disposition: attachment).

### B. Import (POST)
**Endpoint**: `POST /api/v1/doc/{DocType}/import`
**Content-Type**: `multipart/form-data`
**Payload**: CSV/Excel file with headers matching fieldnames.

---

## 7. Metadata API

Used by the Frontend to render Dynamic Forms and Dynamic Lists.

**Endpoint**: `GET /api/v1/meta/doctype/{DocType}`
**Response**:
```json
{
  "success": true,
  "data": {
    "name": "Customer",
    "is_submittable": false,
    "fields": [
      { "fieldname": "customer_name", "fieldtype": "Data", "label": "Name", "required": true }
    ]
  }
}
```
