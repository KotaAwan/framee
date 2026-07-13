# 09-02 Roles and ACL (Access Control List)

## Purpose

Documents how Role-Based Access Control (RBAC) and Access Control Lists (ACL) are evaluated in Framee. This defines how the Permission Engine determines if a user can perform a specific action on a DocType.

---

## 1. Core Concepts

1. **User**: A person logging into the system (`sys_user`).
2. **Role**: A named group of permissions (e.g., `Sales Manager`, `Inventory User`) (`sys_role`).
3. **User-Role Mapping**: A user can have multiple roles (`sys_user_role`).
4. **Permission**: A rule granting access to a specific DocType for a specific Role (`sys_permission`).

---

## 2. DocType Permissions (`sys_permission`)

For every DocType, administrators can assign permissions to roles. The standard permission flags are:

- `can_read`: Can view the list and single documents.
- `can_write`: Can update existing documents (Draft).
- `can_create`: Can create new documents.
- `can_delete`: Can delete documents.
- `can_submit`: Can change status from Draft to Submitted.
- `can_cancel`: Can cancel a Submitted document.
- `can_amend`: Can create an amendment.
- `can_export`: Can export data to CSV/Excel.
- `can_print`: Can generate PDF/Print formats.

### Evaluation Logic (Additive)
If a user has 3 roles, the Permission Engine evaluates them **additively**. If *any* of the user's roles has `can_submit = 1` for `SalesInvoice`, the user can submit it.

---

## 3. Field Level Permissions (perm_level)

Sometimes, a user should be able to view a DocType, but not all fields within it (e.g., viewing an Employee record but hiding the `salary` field).

### How it works:
1. In the DocField metadata (`sys_docfield`), there is a `perm_level` column (default: `0`).
2. If `salary` has `perm_level = 1`, only roles that have a corresponding `sys_permission` rule with `perm_level = 1` for that DocType can read/write the `salary` field.
3. The CRUD Engine filters out fields the user does not have access to before sending the JSON response.

---

## 4. Document Level Permissions (Row-Level Security)

RBAC controls access to the *table*, but sometimes we need to control access to the *row*.

### Supported Rules:
1. **If Owner (`if_owner`)**: A permission rule can be flagged as `if_owner = 1`. This means the role only gets this permission if they are the original creator (`created_by`) of the document.
2. **User Permissions**: A system feature where a user is strictly linked to a specific record (e.g., User A is linked to Branch X). The CRUD Engine will automatically append `AND branch_id = 'Branch X'` to their queries.

---

## 5. The "System Manager" Role

The `System Manager` role is a special hardcoded role.
- Users with this role bypass all standard `sys_permission` checks for metadata and admin operations.
- They have access to the `/api/v1/admin/*` endpoints.
- However, they **do not** automatically bypass tenant isolation (`tenant_id` is still enforced).
