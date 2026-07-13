# 06-07 Database Rules

## Purpose

Specific rules for interacting with the database (MySQL via Knex.js) in Framee. These rules ensure data safety, tenant isolation, and schema consistency.

---

## 1. Mandatory Rules (Non-Negotiable)

### R1: Always include `tenant_id` on every query to `dt_*` and `sys_*`

```javascript
// ✅ Correct
db('dt_customer')
  .where({ tenant_id: tenantId, id: docId })
  .first();

// ❌ WRONG — Risk of cross-tenant data leak
db('dt_customer').where({ id: docId }).first();
```

### R2: Always use parameterized queries (Knex builder)

```javascript
// ✅ Correct
db('dt_customer').where('customer_name', 'like', `%${search}%`);

// ❌ WRONG — SQL Injection risk
db.raw(`SELECT * FROM dt_customer WHERE customer_name LIKE '%${search}%'`);
```

### R3: Never UPDATE or DELETE on `sys_audit_log`

```javascript
// ❌ STRICTLY PROHIBITED
db('sys_audit_log').where({ id: logId }).delete();
db('sys_audit_log').where({ id: logId }).update({ ... });
```

### R4: Use UUID v4 for all primary key `id` values

```javascript
// ✅ Correct
import { randomUUID } from 'crypto';
const newRecord = { id: randomUUID(), tenant_id: tenantId, ... };

// ❌ Wrong — auto-increment is not the Framee standard
// id: 1, 2, 3 ...
```

### R5: Use the `status` column — never `is_deleted` or `is_locked`

```javascript
// ✅ Correct
db('dt_customer').where({ tenant_id: tenantId }).whereNot({ status: 'Deleted' });

// ❌ Wrong
db('dt_customer').where({ is_deleted: 0 });
```

---

## 2. Soft Delete Rule

When "deleting" a record, never use `DELETE FROM`. Perform a status UPDATE:

```javascript
// ✅ Correct — Soft Delete
await db('dt_customer')
  .where({ tenant_id: tenantId, id: docId })
  .update({
    status: 'Deleted',
    deleted_at: new Date(),
    deleted_by: userId,
    delete_reason: reason
  });
```

Exception: Cleanup of old data in background jobs may use physical `DELETE`, but only on log tables (`dt_*_logs`, `dt_*_likes`) after their retention period.

---

## 3. Database Migration Rules

1. **One change = one migration file**. Do not combine ALTER TABLE operations from different tables into one migration file.
2. Migration file names use a timestamp: `20260713120000_add_last_login_to_sys_user.js`.
3. Every migration file MUST have an `up` (apply) and `down` (rollback) function.
4. Never modify a migration file that has already been committed to the repository and run in production. Create a new migration file instead.

---

## 4. Index Rules

Indexes MUST be created for columns frequently used in `WHERE` clauses:
- `tenant_id` (always)
- `status` (frequently filtered)
- `created_at` (for latest-first sorting)
- Columns used as FK lookups (e.g., `customer_id`, `user_id`)

```sql
-- Standard indexes for dt_* tables
INDEX idx_{doctype}_tenant_status (tenant_id, status)
INDEX idx_{doctype}_tenant_created (tenant_id, created_at)
```

---

## 5. Transaction Rules

Use a database transaction when an operation touches more than one table and all steps must either succeed or fail together.

```javascript
// ✅ Correct transaction pattern
await db.transaction(async (trx) => {
  await trx('dt_sales_invoice').insert({ ... });
  await trx('dt_sales_invoice_item').insert([...]);
  // If either fails, both are rolled back automatically
});
```

---

## 6. Column Type Standards

Always follow this mapping when creating new columns via migration:

| Data | MySQL Type |
|------|-----------|
| UUID / Foreign Key | `VARCHAR(36)` |
| Name / Label | `VARCHAR(255)` |
| Code / Enum | `VARCHAR(20)` to `VARCHAR(100)` |
| Long text | `TEXT` |
| HTML content | `LONGTEXT` |
| Boolean | `TINYINT(1)` |
| Integer | `INT` or `INT UNSIGNED` |
| Currency / Amount | `DECIMAL(18, 2)` |
| Quantity / Rate | `DECIMAL(18, 6)` |
| Date | `DATE` |
| Date & Time | `DATETIME` |
| JSON / Metadata | `JSON` |
