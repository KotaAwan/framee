# 05-10 Relationship Rules

## Purpose

Documents the rules governing relationships between tables in Framee — particularly between `sys_*` (system) and `dt_*` (DocType data) tables, and how inter-DocType relationships are managed without breaking the flexibility of the metadata-driven architecture.

---

## 1. Two Types of Relationships in Framee

### A. Hard Relationships (Database Foreign Keys)
Relationships enforced at the MySQL database level with `FOREIGN KEY` constraints. Used for relationships **between static system tables** (`sys_*`) that do not change.

Examples:
- `sys_docfield.doctype_id` → `sys_doctype.id` (ON DELETE CASCADE)
- `sys_user_role.user_id` → `sys_user.id` (ON DELETE CASCADE)
- `sys_permission.role_id` → `sys_role.id` (ON DELETE CASCADE)

**Rule:** Hard FKs are only used for `sys_*` to `sys_*`. They are **NEVER** used from `dt_*` to `dt_*`.

### B. Soft Relationships (Application-Level)
Relationships between `dt_*` tables are **not enforced by the database**. They are configured via metadata (`fieldtype = 'Link'` in `sys_docfield`) and enforced by the **CRUD Engine** / **Permission Engine** at the application level.

Why?
- `dt_*` tables are dynamically created. Creating dynamic FK constraints between tables that may not yet exist is a high-risk DDL operation.
- Flexibility: Admins can delete or modify DocTypes without worrying about unexpected database cascades.
- Tenant isolation: Cross-table references must always pass through the `tenant_id` filter — something standard MySQL `FOREIGN KEY` does not natively support.

---

## 2. Inter-DocType Relationship Types

All inter-DocType relationships are declared through `sys_docfield` configuration:

### A. Link (Many-to-One)
The `customer_id` field in `dt_sales_invoice` refers to one row in `dt_customer`.

```json
{
  "fieldname": "customer_id",
  "fieldtype": "Link",
  "label": "Customer",
  "options": "Customer"
}
```

The CRUD Engine validates that the `customer_id` value sent actually exists in `dt_customer` with the same `tenant_id`, before executing INSERT/UPDATE.

### B. Child Table / Table (One-to-Many)
DocType `SalesInvoice` has an `items` field which is a child table `SalesInvoiceItem`.

```json
{
  "fieldname": "items",
  "fieldtype": "Table",
  "label": "Items",
  "options": "SalesInvoiceItem"
}
```

- `dt_sales_invoice_item` has additional columns `parent_id VARCHAR(36)` and `parent_field VARCHAR(100)`.
- When an Invoice is soft-deleted, the CRUD Engine automatically soft-deletes all child items.

### C. Dynamic Link
A field that refers to a DocType determined by another field in the same document.

```json
{
  "fieldname": "reference_type",
  "fieldtype": "Select",
  "options": "Customer\nSupplier\nPartner"
},
{
  "fieldname": "reference_id",
  "fieldtype": "Dynamic Link",
  "options": "reference_type"
}
```

Validation is performed dynamically based on the `reference_type` value at runtime.

---

## 3. Application-Level Referential Integrity Rules

Since database FKs are not used for `dt_*`, the CRUD Engine must enforce these rules:

| Rule | Implementation |
|------|----------------|
| **Link must be valid** | Before INSERT/UPDATE, query the target DocType to confirm the ID exists and is not deleted. |
| **Link must belong to the same tenant** | Always append `AND tenant_id = :tenantId` when validating. |
| **Delete parent document** | Trigger soft-delete on all child records (Table fieldtype). |
| **Delete a referenced document** | Check if any other documents Link to this document before allowing deletion. Configured per DocType via metadata `on_delete_restriction: true`. |

---

## 4. Additional Columns for Child Table Relationship

`dt_*` tables acting as **Child Tables** have two additional columns auto-injected by the Database Engine:

```sql
parent_id     VARCHAR(36) NULL,    -- Soft FK to parent document
parent_field  VARCHAR(100) NULL    -- Name of the field in parent that contains this child table
```

Example on table `dt_sales_invoice_item`:
- `parent_id` = ID from `dt_sales_invoice`
- `parent_field` = `'items'`

This allows one DocType to be a child of multiple different parent DocTypes.

---

## 5. Decision Summary

```
Is this a sys_* to sys_* relationship?
  → Yes: Use FOREIGN KEY constraint at the database level.

Is this a dt_* to dt_* relationship?
  → Yes: Use fieldtype 'Link' or 'Table' in metadata.
          Enforced at the Application level (CRUD Engine).
          No FK in the database.

Can a child table stand alone?
  → No: Always has parent_id and is accessed via the parent.

Can a referenced (Link) record be deleted?
  → Depends on: metadata 'on_delete_restriction'
  → True: Reject deletion if references still exist.
  → False: Allow it (orphan values remain in DB but UI validation will fail).
```
