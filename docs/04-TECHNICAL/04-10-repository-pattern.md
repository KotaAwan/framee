# 04-10 Repository Pattern

## Purpose

Documents how Framee separates database logic from business logic using the Repository Pattern.

---

## 1. Core Concept

A Repository is exclusively responsible for direct database interactions (Knex.js/MySQL). All SQL queries, JOINs, and transactions are encapsulated here.

**Golden Rule:** Controllers or Services must **NEVER** write SQL queries or call Knex directly.

---

## 2. Generic Repository (Built into Framee)

Because 95% of tables in Framee are dynamically generated, Framee has a **GenericRepository** (typically inside `DatabaseEngine` or extending from it) that provides standard operations for any DocType, with built-in tenant isolation:

```javascript
class GenericRepository {
  constructor(dbConnection, tableName) {
    this.db = dbConnection;
    this.table = tableName;
  }

  // tenant_id is automatically injected on all operations
  async findById(tenantId, id) {
    return this.db(this.table)
      .where({ tenant_id: tenantId, id })
      .whereNot({ status: 'Deleted' })
      .first();
  }

  async insert(tenantId, payload, trx = null) {
    payload.tenant_id = tenantId;
    const query = this.db(this.table).insert(payload);
    if (trx) query.transacting(trx);
    return query;
  }
}
```

---

## 3. Custom Repository

When a module needs complex queries (such as stock calculations, aggregation reporting, or deep JOINs not supported by metadata), developers create a **Custom Repository**.

```javascript
export class SalesInvoiceRepository extends GenericRepository {
  constructor(db) {
    super(db, 'dt_sales_invoice');
  }

  async getUnpaidInvoicesByCustomer(tenantId, customerId) {
    // Domain-specific SQL logic hidden from the Service
    return this.db(this.table)
      .select('id', 'name', 'total_amount', 'outstanding_amount')
      .where({
         tenant_id: tenantId,
         customer_id: customerId,
         status: 'Locked'
      })
      .andWhere('outstanding_amount', '>', 0)
      .orderBy('created_at', 'asc');
  }
}
```

---

## 4. Transaction Management

Repositories must support operations within a database transaction. Therefore, all write methods (Insert/Update/Delete) must be able to accept a Transaction object (`trx`).

```javascript
async updateStatus(tenantId, id, status, trx = null) {
  const query = this.db(this.table)
    .where({ tenant_id: tenantId, id })
    .update({ status, updated_at: new Date() });
    
  if (trx) query.transacting(trx);
  return query;
}
```

Transaction creation (begin, commit, rollback) is performed in the **Service Layer** and passed down to the Repository.
