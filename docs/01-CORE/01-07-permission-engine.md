# 01-07 Permission Engine

## Purpose

The Permission Engine is Framee's **access control layer**. It determines what each user can see, create, edit, delete, submit, or export — for every DocType and every field in the system.

It exists because enterprise ERP systems handle sensitive business data across many roles: accountants, HR managers, sales staff, warehouse operators, and system administrators. Each role must have precise, auditable control over what data they can access and what operations they can perform.

The Permission Engine makes access control declarative and metadata-driven — permissions are configured in the admin UI, not hard-coded in application logic.

---

## Goals

1. Provide role-based access control (RBAC) for all DocType operations (read, write, create, delete, submit, cancel, export).
2. Support field-level permissions — controlling which fields a role can read or write per DocType.
3. Cache permission sets per user to minimize per-request database lookups.
4. Integrate with the API Engine and CRUD Engine so that all operations are permission-checked before execution.
5. Support multi-tenant permission isolation — one tenant's roles and permissions do not affect another's.
6. Provide a permission check API that AI agents can query to understand what actions a user is allowed to perform.

---

## Scope

### In Scope
- Role-based DocType-level permissions (read, write, create, delete, submit, cancel, export, share)
- Field-level read/write permissions per role
- Permission caching in Redis per user session
- Permission enforcement in the API layer (via middleware) and CRUD layer
- Permission inheritance via role hierarchy (parent → child role)
- Permission UI for admins (via System module — see `02-05 Role` and `02-06 User`)
- "Owner" permission — users can always read/edit records they created (configurable)
- Conditional permissions based on document status (e.g., only allow edit if status = Draft)

### Out of Scope
- Object-level security (row-level sharing with specific users or teams) — future feature
- Column-level encryption — security concern, not permission concern
- Network-level access control (IP whitelisting) — infrastructure concern

---

## Functional Requirements

### FR-001 DocType-Level Permissions
- Each Role can be granted specific permission actions on a specific DocType: `read`, `write`, `create`, `delete`, `submit`, `cancel`, `export`, `share`.
- Granting `write` does NOT automatically grant `create` or `delete` — each action must be explicitly granted.
- A user without any permission on a DocType cannot see the DocType exists.

### FR-002 Field-Level Permissions
- A Role can have field-specific read or write restrictions on a DocType.
- If a Role has no field-level restrictions, it inherits the DocType-level permission for all fields.
- If a field is restricted to `read-only` for a Role, the field is included in responses but excluded from update payloads.
- If a field is restricted to `hidden` for a Role, it is excluded entirely from API responses.

### FR-003 Permission Caching
- Compiled permission sets (all permissions for a user across all DocTypes) are cached in Redis.
- Cache key: `framee:perm:{tenant_id}:{user_id}`.
- Cache TTL: 300 seconds (configurable).
- On role assignment change or permission rule change, the cache for affected users is invalidated.

### FR-004 Permission Check API
- The engine exposes a `can(userId, action, doctype, tenantId)` method used by all other engines.
- The engine exposes a `getPermissions(userId, tenantId)` method returning the full compiled permission set.
- Both methods must complete in under 5ms when the cache is warm.

### FR-005 Owner Permission
- If `DocType.owner_permission = true`, a user can always read and edit records they created, regardless of role permissions.
- Owner permission applies only to the creator — not to their manager or team.

### FR-006 Conditional Permissions
- Permissions can be conditionally applied based on document field values.
- Example: A role may have `write` permission only when `status = Draft`. Once status changes, write is revoked.
- Conditions are defined as simple metadata expressions, not arbitrary code.

### FR-007 Role Hierarchy
- Roles can have a `parent_role`. A role inherits all permissions of its parent roles.
- Inheritance is additive — a child role always has at least as many permissions as its parent.
- A child role can have additional permissions beyond its parent (never fewer).

---

## Architecture

```
Incoming Request (userId, action, doctype, tenantId)
              │
              ▼
┌─────────────────────────────────────────────────────┐
│                  Permission Engine                   │
│                                                      │
│  1. Get user roles → [Role A, Role B]                │
│     (from cache or sys_user_role table)              │
│                                                      │
│  2. Get permissions per role for this DocType        │
│     (from cache or sys_permission table)             │
│                                                      │
│  3. Merge permissions across all roles               │
│     (additive union: most permissive wins)           │
│                                                      │
│  4. Apply conditional permissions                    │
│     (check document field conditions if provided)    │
│                                                      │
│  5. Return allow/deny + allowed fields               │
└─────────────────────────────────────────────────────┘
```

### Permission Resolution Rules

| Scenario | Result |
|----------|--------|
| User has Role A (read only) + Role B (read + write) | read + write |
| User has Role A (no permission on DocType X) | access denied for DocType X |
| User created the record + owner_permission enabled | read + write regardless of role |
| Document status = Submitted + role has no submit permission | write denied even if role has write |

---

## Database Design

### `sys_permission` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | VARCHAR(36) | UUID PK |
| `tenant_id` | VARCHAR(36) | Tenant reference |
| `role_id` | VARCHAR(36) | FK → sys_role.id |
| `doctype` | VARCHAR(100) | Target DocType name |
| `can_read` | TINYINT(1) | Allow read |
| `can_write` | TINYINT(1) | Allow write (edit existing) |
| `can_create` | TINYINT(1) | Allow create new records |
| `can_delete` | TINYINT(1) | Allow soft delete |
| `can_submit` | TINYINT(1) | Allow document submission |
| `can_cancel` | TINYINT(1) | Allow cancellation of submitted docs |
| `can_export` | TINYINT(1) | Allow data export |
| `can_share` | TINYINT(1) | Allow sharing record with other users |
| `if_owner` | TINYINT(1) | Apply only to records created by this user |
| `condition_field` | VARCHAR(100) | Conditional: field name to check |
| `condition_value` | VARCHAR(255) | Conditional: required field value |
| `created_at` | DATETIME | Timestamp |
| `updated_at` | DATETIME | Timestamp |

### `sys_docfield_permission` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | VARCHAR(36) | UUID PK |
| `tenant_id` | VARCHAR(36) | Tenant reference |
| `permission_id` | VARCHAR(36) | FK → sys_permission.id |
| `fieldname` | VARCHAR(100) | DocField fieldname |
| `can_read` | TINYINT(1) | Role can read this field |
| `can_write` | TINYINT(1) | Role can write this field |

### `sys_role` Table (Referenced)

| Column | Type | Description |
|--------|------|-------------|
| `id` | VARCHAR(36) | UUID PK |
| `tenant_id` | VARCHAR(36) | Tenant reference |
| `name` | VARCHAR(100) | Role name (unique per tenant) |
| `label` | VARCHAR(150) | Display label |
| `parent_role_id` | VARCHAR(36) | FK → sys_role.id (hierarchy) |
| `is_system_role` | TINYINT(1) | Reserved system role |

### `sys_user_role` Table (Referenced)

| Column | Type | Description |
|--------|------|-------------|
| `id` | VARCHAR(36) | UUID PK |
| `tenant_id` | VARCHAR(36) | Tenant reference |
| `user_id` | VARCHAR(36) | FK → sys_user.id |
| `role_id` | VARCHAR(36) | FK → sys_role.id |

### Indexes

```sql
-- sys_permission
UNIQUE INDEX idx_perm_role_doctype (tenant_id, role_id, doctype)
INDEX idx_perm_tenant_doctype (tenant_id, doctype)

-- sys_docfield_permission
INDEX idx_dfperm_permission (permission_id)
UNIQUE INDEX idx_dfperm_field (permission_id, fieldname)

-- sys_role
UNIQUE INDEX idx_role_name (tenant_id, name)
INDEX idx_role_parent (parent_role_id)

-- sys_user_role
UNIQUE INDEX idx_user_role (tenant_id, user_id, role_id)
INDEX idx_user_role_user (tenant_id, user_id)
```

---

## API Design

### Internal Engine API

```
perm.can(userId, action, doctype, tenantId)
  → Promise<boolean>
  // action: 'read' | 'write' | 'create' | 'delete' | 'submit' | 'cancel' | 'export'

perm.canWithFields(userId, action, doctype, tenantId)
  → Promise<{ allowed: boolean, readableFields: string[], writableFields: string[] }>

perm.getPermissions(userId, tenantId)
  → Promise<PermissionSet>
  // Full compiled permission map for the user

perm.invalidateUser(userId, tenantId)
  → Promise<void>
  // Clear permission cache for a user

perm.invalidateTenantPermissions(tenantId)
  → Promise<void>
  // Clear all permission cache for a tenant
```

### REST API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/system/permissions` | List all DocType permissions for current tenant |
| `POST` | `/api/v1/system/permissions` | Create a permission rule |
| `PUT` | `/api/v1/system/permissions/:id` | Update a permission rule |
| `DELETE` | `/api/v1/system/permissions/:id` | Delete a permission rule |
| `GET` | `/api/v1/system/permissions/check` | Check if current user can perform an action |
| `GET` | `/api/v1/auth/me/permissions` | Get current user's full permission summary |

#### Example — `GET /api/v1/system/permissions/check?action=create&doctype=Customer`

```json
{
  "success": true,
  "data": {
    "allowed": true,
    "action": "create",
    "doctype": "Customer",
    "readable_fields": ["customer_name", "customer_type", "phone"],
    "writable_fields": ["customer_name", "customer_type", "phone"]
  }
}
```

---

## UI Behaviour

- **Permission Setup** — Admins configure permissions via the Role DocType form, which has a child table listing DocType permissions.
- **Field Permission** — A secondary section within the Role form shows field-level read/write configuration.
- **User Role Assignment** — Within the User form, a child table lists assigned roles.
- **Dynamic UI Hiding** — The frontend uses `GET /api/v1/auth/me/permissions` on login to determine which modules, DocTypes, and fields to show/hide. Fields with `can_read: false` are not rendered. Buttons (Create, Edit, Delete, Submit) are shown only if the user has the corresponding permission.

---

## Configuration

| Config Key | Default | Description |
|------------|---------|-------------|
| `PERM_CACHE_TTL` | `300` | Permission cache TTL in seconds |
| `PERM_OWNER_DEFAULT` | `true` | Enable owner permission by default on all DocTypes |
| `PERM_STRICT_MODE` | `true` | Deny if no permission rule found (vs. allow by default) |
| `PERM_SYSTEM_MANAGER_BYPASS` | `true` | System Manager role bypasses all permission checks |

---

## Validation Rules

- A permission rule with `can_read = 0` and all other actions also `0` is effectively no permission — treated as if no rule exists.
- A role cannot have `can_write = 1` and `can_read = 0` — this combination is rejected as illogical.
- A role cannot have `can_submit = 1` without `can_read = 1`.
- `System Manager` is a reserved system role that cannot be deleted or have its permissions modified.
- A user must have at least one role assigned. Accounts with no roles cannot log in.
- Conditional permissions require both `condition_field` and `condition_value` — one without the other is rejected.

---

## Security

- Permissions are enforced at two layers: API middleware (before request reaches business logic) and CRUD Engine (before data mutation).
- `tenant_id` scopes all permission lookups. Cross-tenant permission leakage is architecturally impossible.
- `System Manager` role bypass is a design necessity but is audited — all operations by System Manager users are logged with elevated visibility.
- Permission cache contains no sensitive data (only boolean flags and field name lists).
- Changing a user's roles immediately invalidates their permission cache.
- Changing a permission rule invalidates the cache for all users who hold the affected role.

---

## Events

### Emitted Events

| Event | Payload | Trigger |
|-------|---------|---------|
| `permission.denied` | `{ user_id, action, doctype, tenant_id }` | Permission check failed |
| `permission.cache_hit` | `{ user_id, tenant_id }` | Permissions served from cache |
| `permission.cache_miss` | `{ user_id, tenant_id }` | Permissions fetched from DB |
| `permission.rule_changed` | `{ role_id, doctype, tenant_id }` | Permission rule updated |

### Listened Events

| Event | Action |
|-------|--------|
| `sys_user_role.after_insert` | Invalidate permission cache for affected user |
| `sys_user_role.after_delete` | Invalidate permission cache for affected user |
| `sys_permission.after_save` | Invalidate permission cache for all users in the affected role |

---

## Performance

### Caching
- Compiled permission sets are cached per user per tenant in Redis (TTL: 300 seconds).
- A "compiled permission set" pre-merges all role permissions for a user into a single flat map: `{ DocTypeName: { read: bool, write: bool, fields: { fieldname: { read, write } } } }`.
- This means the `can()` check is an in-memory map lookup after the first cache warm — effectively O(1).

### Database Query Pattern
- On cache miss, permissions are loaded in two queries:
  1. `SELECT role_id FROM sys_user_role WHERE user_id = ?` — get user's roles
  2. `SELECT * FROM sys_permission WHERE role_id IN (...)` — get all permissions for those roles
- A JOIN fetches field-level permissions in the same query.

### Role Hierarchy Resolution
- Role hierarchy is resolved at cache-compile time, not at check time.
- The hierarchy is flattened during compilation — no recursive queries at runtime.

---

## Future Improvements

- **Row-Level Sharing** — Allow specific records to be shared with specific users or user groups, independent of role permissions.
- **Time-Based Permissions** — Permission rules that activate or expire at specific dates (e.g., temporary access grants).
- **Permission Templates** — Pre-built permission sets for common ERP roles (Accountant, HR Manager, Warehouse Staff) installable from a library.
- **Permission Audit Report** — Admin report showing who has access to what across all DocTypes.
- **Attribute-Based Access Control (ABAC)** — Extend beyond RBAC with attribute-based policies for fine-grained control.

---

## Acceptance Criteria

- [ ] A user with `can_read = true` for Customer can call `GET /api/v1/doc/Customer` and receive records.
- [ ] A user without any permission on Customer receives 403 on any Customer endpoint.
- [ ] A user with `can_read = true` but `can_write = false` receives 403 on `PUT /api/v1/doc/Customer/:id`.
- [ ] Field-level hidden fields are excluded from the API response for the relevant role.
- [ ] Field-level read-only fields appear in responses but are excluded from update payloads.
- [ ] After a user's role is changed, their next request uses the updated permissions (within 300 seconds or after cache invalidation).
- [ ] `System Manager` role can access all DocTypes and all operations without explicit permission rules.
- [ ] Permission check `perm.can()` returns a result in under 5ms when the cache is warm.
- [ ] Owner permission allows the creator to edit a record even if their role only has `can_read`.
- [ ] A conditional permission with `condition_field = 'status', condition_value = 'Draft'` allows write only when the record's status is Draft.

---

## Notes

- **Deny by Default** — In `PERM_STRICT_MODE = true`, if no permission rule exists for a user's role on a DocType, access is denied. This is the safest posture for an ERP system.
- **No Role ≠ All Access** — A user with no roles assigned cannot access any DocType. There is no implicit "everyone can access" permission.
- **System Manager vs. Administrator** — `System Manager` is a Framee framework role with full access to all DocTypes. It is distinct from database-level admin credentials. Plugin authors should never require users to be database admins.
- AI agents that generate permission configurations should be warned: granting `can_delete` and `can_write` to broad roles is a common misconfiguration that creates security and data integrity risks in ERP systems.
