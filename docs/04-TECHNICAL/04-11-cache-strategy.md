# 04-11 Cache Strategy

## Purpose

Documents how Framee manages Caching using Redis to ensure high performance, even though the system is very metadata-heavy.

---

## 1. Cache Layers

Framee has 3 primary objects that depend on caching:

1. **Metadata Cache** (Global, change frequency: Low, read frequency: Very High)
2. **Session / Auth Cache** (Global, change frequency: Medium, read frequency: High)
3. **Application Data Cache** (Optional, for data aggregations/dashboards)

---

## 2. Metadata Caching (Two-Tier)

Since DocType metadata will be read on **every** request for validation and routing, access must achieve near-zero latency.

1. **L1: In-Memory Map (Node.js RAM)**
   - Each worker/pod stores metadata cache internally.
   - Fastest possible, but not automatically synchronized across pods.
2. **L2: Redis**
   - Stores JSON string of Metadata.
   - Acts as "Source of Truth" before hitting MySQL.

### Cache Invalidation Mechanism (Event-Driven)
The biggest problem with a Two-Tier Cache is: if an Admin changes the table structure in Pod A, how does Pod B know its in-memory cache is stale?

**Solution:** Redis Pub/Sub.
1. Admin saves a new DocType in Pod A.
2. Pod A saves to MySQL.
3. Pod A deletes the key `meta:doctype:Customer` in Redis.
4. Pod A publishes a Pub/Sub signal to Redis: `PUBLISH cache_invalidate meta:doctype:Customer`.
5. All Pods (including Pod B) are subscribed to the `cache_invalidate` channel and delete their internal memory for that key.
6. On the next request, Pod B reloads the metadata from DB and stores it back in both L1 and L2.

---

## 3. Session & Rate Limiting

- **Rate Limit**: Uses the `express-rate-limit` extension with a Redis Store. The key is typically the IP Address or Tenant ID.
- **Session/Token Blacklist**: Although JWTs are stateless, Framee supports token revocation (Logout/Revoke) by storing the *JTI (JWT ID)* in a Redis Blacklist with a TTL equal to the token's remaining lifetime.

---

## 4. Key Naming Convention

All keys in Redis MUST be prefixed with `framee:` (or the app name) and `tenant_id` if the cache is tenant-specific.

| Purpose | Key Pattern | TTL |
|---------|-------------|-----|
| Global DocType Meta | `framee:meta:doctype:{name}` | Infinite (manually invalidated) |
| Tenant Settings | `framee:tenant:{id}:settings` | 1 Hour |
| JWT Blacklist | `framee:auth:blacklist:{jti}` | Remaining token lifetime |
| Rate Limit IP | `framee:rl:ip:{ip_address}` | 1 Minute |
| Rate Limit Tenant | `framee:rl:tenant:{id}` | 1 Minute |
| Application Query | `framee:tenant:{id}:query:dashboard_summary` | 5 Minutes |

---

## 5. Fallback Mechanism

If the Redis connection drops:
1. The **Cache Engine** will silently continue (Graceful Degradation).
2. Metadata reads will fall directly to In-Memory and then to MySQL.
3. Latency will spike, but the system **must not crash**. (Except for features that are 100% Redis-dependent, such as the Queue.)
