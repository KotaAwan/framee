# 11-03 Scaling Strategy

## Purpose

Documents how Framee is architected to scale horizontally to handle thousands of tenants and high transaction volumes.

---

## 1. Stateless Application Layer

The Framee Node.js Backend is **100% stateless**.
- No session data is stored in memory (JWT is used).
- Uploaded files are streamed directly to Object Storage (e.g., AWS S3), not local disk.
- Cache is centralized in Redis.

**How to Scale**: Simply spin up more Docker containers or Node.js instances (using PM2 cluster mode or Kubernetes ReplicaSets) and place them behind a Load Balancer (e.g., NGINX, AWS ALB).

---

## 2. Database Scaling (MySQL)

Because Framee enforces a strict Tenant ID on every query, the database is highly prepared for scaling.

### A. Connection Pooling
Each Node.js instance maintains a connection pool (via Knex.js). Ensure `DB_POOL_MAX` is tuned so that `Number of Instances * DB_POOL_MAX` does not exceed MySQL's `max_connections`.

### B. Read Replicas
For read-heavy reporting workloads, Framee can be configured to route `SELECT` queries to a Read Replica, while `INSERT/UPDATE/DELETE` go to the Primary DB.

### C. Tenant Sharding (Future-Proofing)
If a single MySQL cluster becomes too large, tenants can be sharded across multiple databases. Because queries never cross tenant boundaries, moving Tenant A to Database 2 while Tenant B stays on Database 1 is architecturally straightforward.

---

## 3. Caching Strategy (Redis)

Framee uses a two-tier cache (Node.js Memory + Redis).

- **L1 (Memory)**: Extremely fast, stores frequently accessed metadata (DocTypes). Invalidated via Redis Pub/Sub.
- **L2 (Redis)**: Shared cache for all instances. Stores rate limiting data, JWT blacklists, and complex query results.

**How to Scale**: Use Redis Cluster or managed services like AWS ElastiCache for high availability and memory scaling.

---

## 4. Background Workers (Queue)

Tasks that take time (Emails, Webhooks, Export/Import, Audit Logging) are pushed to a Redis-backed queue (BullMQ).

**How to Scale**:
- The API servers only *push* jobs to the queue (very fast).
- You can deploy separate "Worker" instances that *only* process jobs.
- If the export queue is backed up, you can spin up 10 Worker instances without affecting API response times.

---

## 5. WebSockets

If real-time notifications are implemented, WebSocket connections are stateful.
- To scale WebSockets across multiple instances, Framee uses the **Redis Adapter** for Socket.io.
- When Instance 1 emits an event, it goes to Redis, which broadcasts it to Instance 2, ensuring the user gets the notification regardless of which server they are connected to.
