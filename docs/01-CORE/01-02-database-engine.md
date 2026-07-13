# 01-02 Database Engine

## Purpose

The Database Engine is Framee's **unified database access layer**. It provides a single, controlled interface through which all parts of the system interact with MySQL. No other engine, service, or plugin accesses the database directly — all database operations flow through the Database Engine.

Its primary function is to enforce architectural boundaries: ensuring all queries are parameterized, all connections are pooled, all tenants are isolated, and all operations are observable and auditable.

---

## Goals

1. Provide a safe, consistent, and efficient query interface for all system components.
2. Enforce tenant isolation on every query automatically — no opt-out.
3. Manage connection pooling to prevent connection exhaustion.
4. Support transactions for multi-step operations that require atomicity.
5. Provide query observability through structured logging of all queries in development and slow queries in production.
6. Abstract the underlying query builder (knex.js) from the rest of the system so it can be swapped without impacting callers.

---

## Scope

### In Scope
- Connection pool management (MySQL via mysql2)
- Query builder interface (wrapping knex.js)
- Automatic tenant scoping on all queries
- Transaction support (begin, commit, rollback)
- Status-based soft delete filtering (automatic `WHERE status != 'Deleted'` for standard queries)
- Database migration runner
- Slow query logging
- Read/write splitting support (future-ready)

### Out of Scope
- Business logic or domain rules (belong in the service layer)
- Metadata about DocTypes (handled by the Metadata Engine)
- Caching of query results (handled by the Cache Engine)
- Schema definition of DocType-owned tables (handled by plugin migrations)

---

## Functional Requirements

### FR-001 Connection Pool
- The Database Engine must manage a configurable connection pool (min/max connections).
- Connections must be released back to the pool after each query, even on error.
- Pool exhaustion must be detected and reported with an appropriate error, not silently queued indefinitely.

### FR-002 Parameterized Queries
- All queries built or executed through the Database Engine must be parameterized.
- The engine must provide no mechanism to execute raw interpolated SQL strings without explicit developer override.

### FR-003 Automatic Tenant Scoping
- Every query executed through the standard interface must automatically append `WHERE tenant_id = :tenantId`.
- Queries that bypass tenant scoping must use an explicit `bypassTenantScope()` builder method and are only permitted for system-level operations.

### FR-004 Status-Based Record Filtering
- All standard read queries must automatically filter `WHERE status != 'Deleted'`.
- Reading deleted records requires an explicit `withDeleted()` builder option.
- The `is_deleted` column is **retired**. The `status` field is the authoritative lifecycle state for all document records.

### FR-005 Transaction Support
- The engine must support wrapping multiple operations in a single database transaction.
- Transactions must roll back automatically if an exception is thrown within the transaction block.

### FR-006 Migration Runner
- The engine includes a migration runner that executes numbered migration files in order.
- The runner tracks executed migrations in a `sys_migrations` table to prevent re-running.
- Supports `up` (apply) and `down` (rollback) operations.

### FR-007 Slow Query Logging
- In production, queries exceeding a configurable threshold (default: 500ms) are logged as warnings with the query plan.
- In development, all queries and their execution time are logged at DEBUG level.

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                   Database Engine                         │
│                                                          │
│  ┌──────────────────┐   ┌──────────────────────────────┐ │
│  │   Query Builder  │   │   Connection Pool Manager    │ │
│  │   (knex.js)      │   │   (mysql2 pool)              │ │
│  └────────┬─────────┘   └──────────────┬───────────────┘ │
│           │                            │                  │
│  ┌────────▼──────────────────────────▼──────────────┐    │
│  │              Execution Layer                       │    │
│  │  Tenant Scoping | Soft Delete | Logging | Errors  │    │
│  └────────────────────────────────────────────────────┘   │
│           │                                               │
│  ┌────────▼───────────────────────────────────┐           │
│  │        Transaction Manager                  │           │
│  │  begin() | commit() | rollback() | wrap()   │           │
│  └────────────────────────────────────────────┘           │
└──────────────────────────────────────────────────────────┘
           │ SQL + params
┌──────────▼──────────────────────────────────────────────┐
│                     MySQL 8.0+                           │
└──────────────────────────────────────────────────────────┘
```

### Layer Responsibilities

| Layer | Responsibility |
|-------|---------------|
| **Query Builder** | Construct SQL queries using knex.js fluent API |
| **Connection Pool** | Manage MySQL connections with min/max bounds |
| **Execution Layer** | Inject tenant scope, soft delete filter, logging |
| **Transaction Manager** | Wrap operations in atomic MySQL transactions |

---

## Database Design

### `sys_migrations` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT | Auto-increment PK |
| `migration_name` | VARCHAR(255) | Migration file name |
| `batch` | INT | Batch number (grouped per run) |
| `executed_at` | DATETIME | Timestamp of execution |

### Standard Column Contract

Every table managed by the Database Engine must follow this column contract:

| Column | Type | Required | Description |
|--------|------|----------|-------------|
| `id` | VARCHAR(36) | Yes | UUID v4 primary key |
| `tenant_id` | VARCHAR(36) | Yes | Tenant isolation key |
| `created_by` | VARCHAR(36) | Yes | FK → sys_user.id |
| `updated_by` | VARCHAR(36) | Yes | FK → sys_user.id |
| `created_at` | DATETIME | Yes | Auto timestamp |
| `updated_at` | DATETIME | Yes | Auto-update timestamp |
| `is_deleted` | TINYINT(1) | Yes | Soft delete flag (default 0) |

### Mandatory Indexes Per Table

```sql
PRIMARY KEY (id)
INDEX idx_{table}_tenant_deleted (tenant_id, is_deleted)
INDEX idx_{table}_tenant_created (tenant_id, created_at)
```

---

## API Design

### Internal Engine API

The Database Engine exposes a programmatic interface (not a REST API) used by repositories:

```
db.query(tenantId)
  .table('sys_user')
  .select(['id', 'email', 'name'])
  .where({ is_active: 1 })
  .orderBy('name', 'asc')
  .paginate({ page: 1, pageSize: 20 })
  → Promise<{ data: [], total: int, page: int, pageSize: int }>

db.query(tenantId)
  .table('sys_user')
  .insert({ id: uuid(), email: '...', ... })
  → Promise<{ id: string }>

db.query(tenantId)
  .table('sys_user')
  .where({ id: '...' })
  .update({ name: 'New Name' })
  → Promise<{ affected: int }>

db.query(tenantId)
  .table('sys_user')
  .where({ id: '...' })
  .softDelete()
  → Promise<{ affected: int }>

db.transaction(tenantId, async (trx) => {
  await trx.table('sys_order').insert({ ... })
  await trx.table('sys_order_item').insert({ ... })
})
→ Promise<void>

db.migrate.up()
db.migrate.down(steps = 1)
db.migrate.status()
```

---

## UI Behaviour

_Not applicable. The Database Engine is a backend-only infrastructure component._

---

## Configuration

| Config Key | Default | Description |
|------------|---------|-------------|
| `DB_HOST` | `localhost` | MySQL server host |
| `DB_PORT` | `3306` | MySQL server port |
| `DB_NAME` | `framee` | Database name |
| `DB_USER` | — | MySQL username (env var) |
| `DB_PASSWORD` | — | MySQL password (env var) |
| `DB_POOL_MIN` | `2` | Minimum pool connections |
| `DB_POOL_MAX` | `20` | Maximum pool connections |
| `DB_CHARSET` | `utf8mb4` | Connection character set |
| `DB_TIMEZONE` | `UTC` | Query timezone |
| `DB_SLOW_QUERY_MS` | `500` | Slow query threshold (ms) |
| `DB_LOG_QUERIES` | `false` | Log all queries (dev mode) |
| `DB_SSL` | `false` | Enable SSL for DB connection |

---

## Validation Rules

- `id` must always be a valid UUID v4 format. The engine auto-generates IDs if not provided on insert.
- `tenant_id` must always be a non-null, non-empty string. Inserting without a `tenant_id` raises an engine-level error.
- All `UPDATE` operations must include a `WHERE` clause. Naked updates (updating all rows) are blocked by the engine.
- All `DELETE` operations must use `softDelete()`. Direct `DELETE` statements are not exposed in the standard interface.
- The migration runner validates migration file naming: must match pattern `^\d{3}_[a-z0-9_]+\.js$`.

---

## Security

- Database credentials are loaded exclusively from environment variables. They are never hard-coded or logged.
- All SQL is generated via parameterized query builder — no string concatenation.
- The `bypassTenantScope()` method is internal to the engine and not exposed to plugin code.
- Connection pool configuration limits prevent a single tenant or request from exhausting all database connections.
- Slow query logs do not include raw parameter values to prevent credential/PII leakage in log files.
- The migration runner requires explicit permission (`System Manager` role) when triggered via API.

---

## Events

### Emitted Events

| Event | Payload | Trigger |
|-------|---------|---------|
| `db.connected` | `{ pool_min, pool_max }` | Successful pool initialization |
| `db.query.slow` | `{ sql, duration_ms, tenant_id }` | Query exceeds slow threshold |
| `db.pool.exhausted` | `{ waiting_requests }` | Pool at max capacity |
| `db.migrate.complete` | `{ batch, migrations: [] }` | Migration batch complete |
| `db.error` | `{ error, sql }` | Database error (sanitized) |

### Listened Events

_The Database Engine does not subscribe to external events. It is a low-level infrastructure layer._

---

## Performance

### Connection Pooling
- The pool is initialized once on startup and reused across all requests.
- Pool `min` ensures warm connections are always available.
- Pool `max` caps concurrent connections to protect MySQL from being overwhelmed.
- Idle connections are released after a configurable idle timeout.

### Query Optimization
- The query builder generates efficient SQL with explicit `SELECT` field lists — no `SELECT *` in production queries.
- Pagination is implemented with `LIMIT/OFFSET` for small datasets and cursor-based pagination for large datasets.
- All tenant-scoped queries benefit from the `(tenant_id, is_deleted)` composite index.

### Batch Operations
- Bulk inserts use a single `INSERT INTO ... VALUES (...), (...)` statement rather than looping individual inserts.
- Batch size is capped at 500 rows per statement to avoid packet size limits.

### Caching Integration
- The Database Engine does NOT cache. All caching is handled by the Cache Engine.
- The separation allows the Cache Engine to have full control over TTL, invalidation, and key strategy.

---

## Future Improvements

- **Read/Write Splitting** — Route `SELECT` queries to a read replica and write operations to the primary.
- **Query Profiling Dashboard** — Admin UI showing top slow queries and query count per endpoint.
- **Automatic Index Advisor** — Analyze query patterns and suggest missing indexes.
- **Multi-Database Support** — Abstract the engine to support PostgreSQL as an alternative backend.
- **Horizontal Sharding** — Tenant-based database sharding for large-scale multi-tenant deployments.
- **Streaming Queries** — Support cursor-based streaming for large export operations.

---

## Acceptance Criteria

- [ ] The connection pool initializes with `DB_POOL_MIN` connections on boot and closes cleanly on shutdown.
- [ ] All queries executed through `db.query()` include `WHERE tenant_id = ?` automatically.
- [ ] All read queries executed through `db.query()` include `WHERE is_deleted = 0` automatically.
- [ ] A transaction that throws an error mid-way rolls back all previously executed statements.
- [ ] A successful transaction commits all statements atomically.
- [ ] Inserting a record without `tenant_id` raises a validation error before hitting the database.
- [ ] A naked `UPDATE` without a `WHERE` clause raises an engine-level error.
- [ ] `db.migrate.up()` executes pending migrations and records them in `sys_migrations`.
- [ ] `db.migrate.down(1)` rolls back the last batch of migrations.
- [ ] A query taking longer than `DB_SLOW_QUERY_MS` emits the `db.query.slow` event and logs a warning.
- [ ] Pool exhaustion is detected and logged — the system does not crash, it returns an appropriate error response.

---

## Notes

- **No ORM** — Framee deliberately avoids ORM frameworks (Sequelize, Prisma, TypeORM). Knex.js is used as a query builder only. This is intentional: ORMs impose schema conventions that conflict with metadata-driven architecture.
- **UTC Everywhere** — All database timestamps are stored and read in UTC. Timezone conversion is a presentation concern handled by the frontend.
- **Idempotent Migrations** — Migrations must be written to be idempotent where possible. A migration that has already been applied must not fail if run again (use `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, etc.).
- Plugin migrations are separate from core migrations. They are run by the Plugin Loader, not the core migration runner. Plugin migrations must also follow the same column contract.
