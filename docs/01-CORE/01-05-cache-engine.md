# 01-05 Cache Engine

## Purpose

The Cache Engine is Framee's **unified caching layer**. It provides a consistent, abstracted interface for reading and writing cached data backed by Redis, used by all other engines and services in the system.

Rather than allowing every engine to interact with Redis directly with inconsistent key strategies and TTL policies, the Cache Engine acts as the single intermediary — enforcing key namespacing, tenant isolation, serialization standards, and TTL governance.

---

## Goals

1. Provide a consistent, type-safe caching interface for all engines and services.
2. Enforce tenant-scoped cache key namespacing to prevent cross-tenant data leakage.
3. Abstract Redis implementation details so the underlying cache provider can be changed with minimal impact.
4. Support common caching patterns: get-or-set, invalidation, bulk invalidation, and TTL management.
5. Enable distributed cache invalidation across multiple backend instances via Redis Pub/Sub.
6. Provide cache observability (hit rate, miss rate, key count) for performance monitoring.

---

## Scope

### In Scope
- Redis connection management and health monitoring
- Get, Set, Delete, Exists, and TTL operations with namespaced keys
- Tenant-scoped key strategy
- Serialization and deserialization of cached values (JSON)
- get-or-set (cache-aside) pattern helper
- Bulk key invalidation by pattern (e.g., invalidate all cache for a tenant)
- Redis Pub/Sub for cross-instance cache invalidation signals
- Cache statistics (hit/miss counters per namespace)

### Out of Scope
- Session management (separate concern using Redis but with its own key strategy)
- Rate limit counters (managed by the API Engine's rate limit middleware using Redis directly)
- Job queues and background tasks (future Queue Engine)
- In-memory process-level caching (LRU caches within individual engines are managed locally)

---

## Functional Requirements

### FR-001 Namespaced Keys
- All cache keys must follow the pattern: `{prefix}:{namespace}:{tenant_id}:{key}`.
- Default prefix: `framee`.
- Namespaces: `meta` (metadata), `session` (user sessions), `perm` (permissions), `data` (application data).

### FR-002 Tenant Isolation
- All cache operations that involve tenant-specific data must include `tenant_id` in the key.
- The engine must reject operations that attempt to write to a tenant key without a valid `tenant_id`.

### FR-003 Get-or-Set Pattern
- The engine must provide a `getOrSet(key, fetchFn, ttl)` method that checks the cache first, and on miss, calls `fetchFn()`, stores the result, and returns it.
- This eliminates the need for callers to implement their own cache-aside logic.

### FR-004 TTL Management
- All cache entries must have an explicit TTL. Setting a cache entry without TTL is forbidden.
- The engine must support TTL extension (bump an existing entry's expiry without re-fetching the value).

### FR-005 Invalidation
- The engine must support single-key invalidation: `invalidate(key)`.
- The engine must support pattern-based bulk invalidation: `invalidatePattern(pattern)` (e.g., `framee:meta:tenant123:*`).
- Pattern-based invalidation must use Redis `SCAN` with `MATCH` — not `KEYS` — to avoid blocking Redis.

### FR-006 Pub/Sub Invalidation
- In multi-instance deployments, cache invalidation signals must be published to a Redis Pub/Sub channel.
- All instances subscribe to the invalidation channel and invalidate their local in-memory caches when a signal is received.

### FR-007 Health Check
- The Cache Engine must expose a `ping()` method that returns Redis connection status.
- This is consumed by the `/api/v1/system/health` endpoint.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      Cache Engine                             │
│                                                              │
│  ┌────────────────────┐   ┌──────────────────────────────┐  │
│  │   Key Builder       │   │   Serializer / Deserializer  │  │
│  │  prefix:ns:tid:key  │   │   JSON.stringify / parse     │  │
│  └──────────┬──────────┘   └──────────────┬───────────────┘  │
│             │                             │                   │
│  ┌──────────▼─────────────────────────▼──────────────────┐  │
│  │                   Operation Layer                       │  │
│  │  get | set | del | exists | ttl | getOrSet | extend    │  │
│  └──────────────────────────────────────────────────────┘  │
│                          │                                   │
│  ┌───────────────────────▼──────────────────────────────┐  │
│  │              Invalidation Manager                      │  │
│  │  invalidate(key) | invalidatePattern(pattern)          │  │
│  │  publish(channel, key) | subscribe(channel, handler)  │  │
│  └───────────────────────────────────────────────────────┘  │
└────────────────────────────┬─────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────┐
│                      Redis 7.0+                               │
│  Cluster-ready | Pub/Sub | SCAN | TTL                         │
└──────────────────────────────────────────────────────────────┘
```

### Key Namespaces

| Namespace | Used By | Example Key |
|-----------|---------|-------------|
| `meta` | Metadata Engine | `framee:meta:t123:Customer` |
| `perm` | Permission Engine | `framee:perm:t123:user456` |
| `session` | Auth Service | `framee:session:sess789` |
| `data` | Services (app data) | `framee:data:t123:dashboard_summary` |

---

## Database Design

_The Cache Engine has no MySQL tables. All data is stored in Redis with TTL-based expiry._

### Redis Key Strategy

| Pattern | Example | Description |
|---------|---------|-------------|
| `framee:{ns}:{tid}:{key}` | `framee:meta:t123:Customer` | Standard tenant-scoped entry |
| `framee:session:{session_id}` | `framee:session:sess789` | User session (no tenant scope) |
| `framee:invalidate` | — | Pub/Sub channel name for invalidation signals |
| `framee:stats:{ns}:hits` | `framee:stats:meta:hits` | Hit counter per namespace |
| `framee:stats:{ns}:misses` | `framee:stats:meta:misses` | Miss counter per namespace |

---

## API Design

### Internal Engine API (Programmatic)

```
cache.get(namespace, tenantId, key)
  → Promise<value | null>

cache.set(namespace, tenantId, key, value, ttlSeconds)
  → Promise<void>

cache.del(namespace, tenantId, key)
  → Promise<void>

cache.exists(namespace, tenantId, key)
  → Promise<boolean>

cache.getOrSet(namespace, tenantId, key, fetchFn, ttlSeconds)
  → Promise<value>
  // If cache miss: calls fetchFn(), stores result, returns it.

cache.extendTTL(namespace, tenantId, key, additionalSeconds)
  → Promise<void>

cache.invalidatePattern(namespace, tenantId, keyPattern)
  → Promise<number>  // returns count of invalidated keys

cache.invalidateTenant(tenantId)
  → Promise<number>  // invalidates ALL cache for a tenant

cache.ping()
  → Promise<{ status: 'ok' | 'error', latency_ms: number }>

cache.stats(namespace)
  → Promise<{ hits: number, misses: number, hit_rate: number }>
```

### REST API (Admin)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/system/cache/health` | Redis connection health |
| `GET` | `/api/v1/system/cache/stats` | Cache hit/miss statistics per namespace |
| `DELETE` | `/api/v1/system/cache/tenant/:tenantId` | Flush all cache for a tenant (admin) |
| `DELETE` | `/api/v1/system/cache/namespace/:ns` | Flush all cache for a namespace (admin) |

---

## UI Behaviour

_Cache Engine has no direct UI. Admin users access cache statistics and flush controls via the System Settings page, which calls the admin REST API endpoints above._

---

## Configuration

| Config Key | Default | Description |
|------------|---------|-------------|
| `REDIS_HOST` | `localhost` | Redis server host |
| `REDIS_PORT` | `6379` | Redis server port |
| `REDIS_DB` | `0` | Redis database index |
| `REDIS_PASSWORD` | — | Redis auth password (env var) |
| `REDIS_TLS` | `false` | Enable TLS for Redis connection |
| `CACHE_PREFIX` | `framee` | Global key prefix |
| `CACHE_METADATA_TTL` | `3600` | TTL for metadata cache (seconds) |
| `CACHE_PERMISSION_TTL` | `300` | TTL for permission cache (seconds) |
| `CACHE_SESSION_TTL` | `900` | TTL for session cache (seconds) |
| `CACHE_DATA_TTL` | `60` | TTL for application data cache (seconds) |
| `CACHE_PUBSUB_ENABLED` | `false` | Enable Pub/Sub invalidation (multi-instance) |
| `CACHE_PUBSUB_CHANNEL` | `framee:invalidate` | Redis Pub/Sub channel name |

---

## Validation Rules

- `ttlSeconds` must be a positive integer. Zero or negative TTL values are rejected.
- `namespace` must be one of the registered namespaces: `meta`, `perm`, `session`, `data`. Custom namespaces require explicit registration.
- `key` must not contain the `:` delimiter character to prevent key collisions.
- `tenant_id` is mandatory for all namespace operations except `session`.
- `invalidateTenant()` is a high-impact operation that requires System Manager role when called via API.

---

## Security

- Redis password is loaded from environment variable, never hard-coded.
- All cache keys include `tenant_id` to prevent cross-tenant cache reads.
- The `invalidateTenant()` admin endpoint requires System Manager role.
- Redis TLS is recommended for production deployments where Redis is accessed over a network.
- Pub/Sub channel is authenticated with the same Redis password. Public Pub/Sub channels are not permitted.
- Cache values are serialized as JSON. Deserialized values are treated as untrusted and validated before use in security-sensitive operations (e.g., permission checks re-validate against DB periodically).

---

## Events

### Emitted Events

| Event | Payload | Trigger |
|-------|---------|---------|
| `cache.hit` | `{ namespace, tenant_id, key }` | Successful cache read |
| `cache.miss` | `{ namespace, tenant_id, key }` | Cache miss (DB fallback) |
| `cache.invalidated` | `{ namespace, tenant_id, key }` | Single key invalidated |
| `cache.flushed` | `{ namespace, tenant_id, count }` | Bulk invalidation completed |
| `cache.error` | `{ operation, error }` | Redis operation error |
| `cache.connected` | `{ host, port }` | Redis connection established |
| `cache.disconnected` | `{ reason }` | Redis connection lost |

### Listened Events

| Event | Action |
|-------|--------|
| `cache.invalidate_signal` (Pub/Sub) | Invalidate local in-memory cache for signaled key |

---

## Performance

### Hit Rate Optimization
- Metadata cache TTL of 3600 seconds ensures very high hit rates for rarely-changing DocType definitions.
- Permission cache TTL of 300 seconds balances freshness with performance for role-based access patterns.

### SCAN vs KEYS
- Pattern invalidation uses Redis `SCAN` with a cursor loop and `MATCH` filter.
- `KEYS` command is never used — it blocks Redis for the duration of the scan.
- Batch size for SCAN is configurable (default: 100 keys per scan iteration).

### Pipeline Batching
- When warming the metadata cache on boot, keys are written using Redis `PIPELINE` to batch commands and reduce round-trips.
- Read batches (e.g., fetching multiple DocType metadata in one operation) use `MGET` where applicable.

### Connection Management
- ioredis connection pooling is used for write-heavy scenarios.
- Read-heavy access patterns can use a dedicated ioredis cluster client with automatic read scaling.

---

## Future Improvements

- **Redis Cluster Support** — ioredis cluster client for horizontal Redis scaling.
- **Cache Warming API** — Admin endpoint to manually warm cache for specific namespaces or tenants.
- **Cache Profiler** — Developer tool showing which cache keys are accessed most frequently.
- **Conditional TTL** — Dynamic TTL based on access frequency (frequently accessed keys get longer TTL).
- **Encrypted Cache Values** — Option to encrypt sensitive cache values at rest in Redis.
- **Multi-Tier Cache** — L1 (process-level LRU) + L2 (Redis) cache hierarchy for ultra-low latency reads.

---

## Acceptance Criteria

- [ ] `cache.set('meta', tenantId, 'Customer', data, 3600)` stores the value in Redis with a 3600s TTL.
- [ ] `cache.get('meta', tenantId, 'Customer')` returns the stored value within 1ms.
- [ ] `cache.get()` returns `null` on cache miss (not an error).
- [ ] `cache.getOrSet()` calls the fetch function exactly once on cache miss and caches the result.
- [ ] `cache.getOrSet()` does not call the fetch function on cache hit.
- [ ] `cache.del()` removes the key from Redis, and subsequent `get` returns null.
- [ ] `cache.invalidatePattern('meta', tenantId, '*')` removes all meta keys for a tenant.
- [ ] Keys for `tenant_id = 't1'` are not accessible or invalidated when operating with `tenant_id = 't2'`.
- [ ] `cache.ping()` returns `{ status: 'ok' }` when Redis is reachable.
- [ ] `cache.ping()` returns `{ status: 'error' }` when Redis is unreachable (graceful degradation).
- [ ] Cache stats endpoint returns accurate hit and miss counts.
- [ ] Admin flush endpoint requires System Manager role; other roles receive 403.

---

## Notes

- **Graceful Degradation** — If Redis is unavailable, the Cache Engine must return a null/miss result and log an error. It must NEVER throw an unhandled exception that crashes the server. The system must be able to operate (with degraded performance) without Redis.
- **No Business Data in Cache by Default** — Application data caching (namespace `data`) is opt-in. Not all services cache their results — only those where the performance benefit justifies the complexity.
- **Cache is not the source of truth** — MySQL is always the source of truth. Cache is a performance layer. Any inconsistency must resolve in favor of the database.
- **Pub/Sub is production-optional** — In single-instance deployments, Pub/Sub invalidation is unnecessary. Enable it only when running multiple backend process instances behind a load balancer.
