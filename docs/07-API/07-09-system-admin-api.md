# 07-09 System & Admin API

## Purpose

Documents the System Administration API endpoints for managing tenants, users, roles, permissions, DocTypes, and system settings. These endpoints are restricted to users with the `System Manager` role.

---

## Base URL

`/api/v1/admin`

All endpoints require:
- `Authorization: Bearer <access_token>` header.
- User must have the `System Manager` role, enforced at the Controller level.

---

## User Management

### GET `/api/v1/admin/users`
Returns paginated list of all users in the tenant. Supports `?search`, `?filters[status]`.

### POST `/api/v1/admin/users`
Creates a new user.
```json
{
  "email": "budi@company.com",
  "full_name": "Budi Santoso",
  "password": "initial_password",
  "roles": ["Sales User", "Inventory User"]
}
```

### PUT `/api/v1/admin/users/:id`
Updates user profile or status (activate/deactivate).

### POST `/api/v1/admin/users/:id/roles`
Replaces the user's role assignments.
```json
{ "roles": ["Sales Manager", "Inventory User"] }
```

---

## Role & Permission Management

### GET `/api/v1/admin/roles`
Returns all roles defined in the tenant.

### POST `/api/v1/admin/roles`
Creates a new role.
```json
{ "name": "Warehouse Supervisor", "description": "..." }
```

### GET `/api/v1/admin/permissions/:roleId`
Returns all DocType permissions configured for a given role.

### PUT `/api/v1/admin/permissions/:roleId/:doctypeId`
Updates permissions for a role on a specific DocType.
```json
{
  "can_read": true,
  "can_write": true,
  "can_create": true,
  "can_delete": false,
  "can_submit": false,
  "can_export": true
}
```

---

## DocType Management

### GET `/api/v1/admin/doctypes`
Returns all DocTypes (including inactive ones), with full metadata.

### POST `/api/v1/admin/doctypes`
Creates a new DocType. This triggers DB Engine to create the corresponding `dt_*` table.
```json
{
  "name": "WarrantyCard",
  "module_id": "uuid-of-service-module",
  "is_submittable": false,
  "track_changes": true,
  "name_series": "WC-.YYYY.-.####"
}
```

### PUT `/api/v1/admin/doctypes/:name`
Updates DocType metadata (e.g., toggle `track_changes`, update `name_series`).

### POST `/api/v1/admin/doctypes/:name/fields`
Adds a new custom field to a DocType. Triggers `ALTER TABLE` on the underlying `dt_*` table.
```json
{
  "fieldname": "warranty_period_months",
  "label": "Warranty Period (Months)",
  "fieldtype": "Int",
  "reqd": 1,
  "default_value": "12"
}
```

---

## System Settings

### GET `/api/v1/admin/settings`
Returns all tenant system settings.

### PUT `/api/v1/admin/settings/:key`
Updates a specific system setting.
```json
{ "value": "IDR" }
```

---

## Audit Log (Admin Only)

### GET `/api/v1/admin/audit-log`
Returns the global immutable audit log (`sys_audit_log`). Supports filtering by doctype, user, action, and date range.

**Query Parameters:**
- `doctype` — Filter by DocType: `?doctype=SalesInvoice`
- `user_id` — Filter by user
- `action` — Filter by action type: `?action=DELETE`
- `from_date`, `to_date` — Date range filter

**Response `200 OK`:**
```json
{
  "success": true,
  "data": [ ... ],
  "meta": { "total": 5432, "page": 1, "pageSize": 50 }
}
```
