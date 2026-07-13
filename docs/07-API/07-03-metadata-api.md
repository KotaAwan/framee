# 07-03 Metadata API

## Purpose

Documents the API endpoints that serve DocType metadata to the frontend. These endpoints are called by the frontend on page load to determine what fields to render, what permissions apply, and how the UI should behave.

---

## Base URL

`/api/v1/meta`

---

## Endpoints

### GET `/api/v1/meta/doctype/:name`

Returns the full metadata for a single DocType — including field definitions, permissions for the current user, and workflow configuration.

**Path Parameter:** `:name` — The DocType name (e.g., `Customer`, `SalesInvoice`).

**Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "name": "Customer",
    "is_submittable": false,
    "track_changes": true,
    "name_series": "CUST-.YYYY.-.####",
    "fields": [
      {
        "fieldname": "customer_name",
        "label": "Customer Name",
        "fieldtype": "Data",
        "reqd": 1,
        "in_list_view": 1,
        "sort_order": 1
      },
      {
        "fieldname": "customer_type",
        "label": "Customer Type",
        "fieldtype": "Select",
        "options": ["Company", "Individual"],
        "reqd": 1,
        "sort_order": 2
      },
      {
        "fieldname": "status",
        "label": "Status",
        "fieldtype": "Select",
        "options": ["Draft", "Active", "Archived", "Deleted"],
        "sort_order": 3
      }
    ],
    "permissions": {
      "can_read": true,
      "can_write": true,
      "can_create": true,
      "can_delete": false,
      "can_submit": false,
      "can_export": true,
      "can_import": false,
      "can_print": true
    },
    "workflow": null
  }
}
```

**Error Responses:**
- `404` — DocType not found or not active.
- `403` — User does not have `can_read` permission on this DocType.

---

### GET `/api/v1/meta/doctypes`

Returns a list of all accessible DocTypes for the current user (based on permissions). Used for building navigation menus and DocType pickers.

**Query Parameters:**
- `module` (optional) — Filter by module name: `?module=CRM`
- `fields` (optional) — Return only specific fields: `?fields=name,label,module_id`

**Response `200 OK`:**
```json
{
  "success": true,
  "data": [
    {
      "name": "Customer",
      "label": "Customer",
      "module_id": "crm-module-id",
      "is_submittable": false
    },
    {
      "name": "SalesInvoice",
      "label": "Sales Invoice",
      "module_id": "accounting-module-id",
      "is_submittable": true
    }
  ]
}
```

---

### GET `/api/v1/meta/modules`

Returns all modules the current user can access.

**Response `200 OK`:**
```json
{
  "success": true,
  "data": [
    { "name": "CRM", "icon": "users" },
    { "name": "Accounting", "icon": "calculator" },
    { "name": "HR", "icon": "briefcase" }
  ]
}
```

---

### GET `/api/v1/meta/link-options/:doctype`

Returns a searchable list of records for a `Link` field dropdown. Called when a user types in a Link input field.

**Path Parameter:** `:doctype` — The target DocType to search in.

**Query Parameters:**
- `search` — Search term: `?search=PT.%20Maju`
- `limit` — Max results (default: 10): `?limit=20`

**Response `200 OK`:**
```json
{
  "success": true,
  "data": [
    { "id": "uuid-1", "name": "CUST-0001", "label": "PT. Maju Jaya" },
    { "id": "uuid-2", "name": "CUST-0002", "label": "PT. Maju Sentosa" }
  ]
}
```

> The `label` field is determined by the DocType's `name_field` or the first `Data` field marked as `in_list_view`.
