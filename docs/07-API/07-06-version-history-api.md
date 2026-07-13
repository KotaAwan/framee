# 07-06 Version History API

## Purpose

Documents the API endpoints for the Version History feature — retrieving document version snapshots and restoring a document to a previous version.

---

## Base URL

`/api/v1/doc/:doctype/:id/versions`

---

## Endpoints

### GET `/api/v1/doc/:doctype/:id/versions`

Returns a paginated list of all version snapshots for a document.

**Query Parameters:**
- `page` (default: 1)
- `pageSize` (default: 20)

**Response `200 OK`:**
```json
{
  "success": true,
  "data": [
    {
      "id": "ver-uuid-5",
      "version_number": 5,
      "change_summary": "Restored to version 3",
      "created_by_name": "Sutikno",
      "created_at": "2026-07-13T10:30:00Z"
    },
    {
      "id": "ver-uuid-4",
      "version_number": 4,
      "change_summary": "Updated credit_limit, payment_terms",
      "created_by_name": "Budi",
      "created_at": "2026-07-13T09:00:00Z"
    },
    {
      "id": "ver-uuid-3",
      "version_number": 3,
      "change_summary": "Updated customer_name",
      "created_by_name": "Sutikno",
      "created_at": "2026-07-13T08:00:00Z"
    }
  ],
  "meta": { "total": 5, "page": 1, "pageSize": 20, "totalPages": 1 }
}
```

---

### GET `/api/v1/doc/:doctype/:id/versions/:versionNumber`

Returns the full JSON snapshot of a specific version — all field values at that point in time.

**Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "id": "ver-uuid-3",
    "version_number": 3,
    "change_summary": "Updated customer_name",
    "created_by_name": "Sutikno",
    "created_at": "2026-07-13T08:00:00Z",
    "snapshot": {
      "id": "doc-uuid",
      "name": "CUST-0001",
      "status": "Draft",
      "customer_name": "PT. Maju Jaya (Old Name)",
      "customer_type": "Company",
      "credit_limit": 10000000,
      "version": 3
    }
  }
}
```

---

### POST `/api/v1/doc/:doctype/:id/restore`

Restores a document to a previous version. This creates a **new version** with the old snapshot's content — it does not overwrite existing version history.

**Request Body:**
```json
{
  "version_number": 3
}
```

**Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "id": "doc-uuid",
    "name": "CUST-0001",
    "customer_name": "PT. Maju Jaya (Old Name)",
    "version": 6,
    "change_summary": "Restored to version 3"
  }
}
```

**Error Responses:**
- `404` — Version number not found for this document.
- `409` — Document is Locked or Submitted. Cannot be modified directly.
- `403` — No `can_write` permission.
