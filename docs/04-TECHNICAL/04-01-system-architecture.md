# 04-01 System Architecture

## Purpose

Documents the overall system architecture of Framee — how all layers (Frontend, API, Core Engines, Database, Cache) connect to each other, and the architectural principles that every engineer and every AI agent contributing to the framework must follow.

---

## Overview

Framee is a **Metadata-Driven ERP Framework** built on a plugin-first architecture. All system behavior — forms, lists, validation, permissions, workflows — is declared in metadata, not in hardcoded code.

```
┌────────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                               │
│                                                                    │
│   Browser / Mobile Browser / (future: Mobile App)                  │
│   Next.js 15 (Pages Router) — React 19                             │
└───────────────────────────────┬────────────────────────────────────┘
                                │ HTTPS / REST
┌───────────────────────────────▼────────────────────────────────────┐
│                        GATEWAY LAYER                               │
│                                                                    │
│   Express.js 5.x                                                   │
│   ├── Rate Limiting (express-rate-limit + Redis)                   │
│   ├── CORS                                                         │
│   ├── JWT Authentication (verify token)                            │
│   ├── Tenant Context Injection                                     │
│   └── Request Logging                                              │
└───────────────────────────────┬────────────────────────────────────┘
                                │
┌───────────────────────────────▼────────────────────────────────────┐
│                        CORE ENGINE LAYER                           │
│                                                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐    │
│  │ Metadata     │  │ CRUD         │  │ API Engine             │    │
│  │ Engine       │  │ Engine       │  │ (auto-route generator) │    │
│  └──────────────┘  └──────────────┘  └────────────────────────┘    │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐    │
│  │ Permission   │  │ Workflow     │  │ Document Lifecycle     │    │
│  │ Engine       │  │ Engine       │  │ Engine                 │    │
│  └──────────────┘  └──────────────┘  └────────────────────────┘    │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐    │
│  │ Cache        │  │ Event        │  │ Audit Engine           │    │
│  │ Engine       │  │ Engine       │  │ (Local + Global Log)   │    │
│  └──────────────┘  └──────────────┘  └────────────────────────┘    │
│  ┌──────────────┐                                                  │
│  │ Version      │                                                  │
│  │ Engine       │                                                  │
│  └──────────────┘                                                  │
└───────────────────────────────┬────────────────────────────────────┘
                                │
             ┌──────────────────┴──────────────────┐
             │                                     │
┌────────────▼───────────────┐         ┌───────────▼─────────────────┐
│    DATABASE LAYER          │         │       CACHE LAYER           │
│    MySQL 8.x               │         │       Redis 8.x             │
│                            │         │                             │
│  sys_* tables (core)       │         │  Metadata cache             │
│  dt_* tables (DocType)     │         │  Session store              │
│  dt_*_logs (log & comment) │         │  Rate limit counters        │
│  dt_*_likes (likes)        │         │  Job queue                  │
│  sys_audit_log (global)    │         │  Pub/Sub events             │
└────────────────────────────┘         └─────────────────────────────┘
```

---

## Architectural Layers

### 1. Client Layer
- **Next.js 15** (Pages Router) running in browser.
- Communicates exclusively via REST API — no direct database or cache access.
- State managed by **Zustand** (global: user, tenant, metadata cache).
- All HTTP calls via **Axios** with centralized interceptors.

### 2. Gateway Layer
- **Express.js 5.x** handles all incoming HTTP requests.
- Every request passes through the middleware pipeline:
  1. **Rate Limiter** — prevents abuse.
  2. **CORS** — whitelist only.
  3. **JWT Verifier** — extracts and validates `Authorization: Bearer <token>`.
  4. **Tenant Injector** — resolves `tenant_id` from JWT and attaches to `req.tenant`.
  5. **Request Logger** — structured log per request.
- No business logic at this layer.

### 3. Core Engine Layer
Each engine is a **singleton service** loaded at startup:

| Engine | Responsibility |
|--------|---------------|
| Metadata Engine | DocType schema loading and cache |
| Database Engine | MySQL connection pool, query builder, tenant scope |
| CRUD Engine | Generic Create/Read/Update/Delete for all DocTypes |
| API Engine | Auto-generate Express routes from DocType metadata |
| Cache Engine | Redis abstraction (get/set/invalidate/subscribe) |
| Event Engine | Pub/Sub for lifecycle events |
| Permission Engine | Role-based access control gate |
| Workflow Engine | State machine for document status transitions |
| Document Lifecycle Engine | `canPerform()` gate for all write operations |
| Audit Engine | Two-tier logging (Local + Global) |
| Version Engine | Document snapshot history |

### 4. Database Layer
- **MySQL 8.x** — primary data store.
- Two table namespaces:
  - `sys_*` — framework/system tables (managed by core).
  - `dt_*` — DocType data tables (auto-generated per DocType).
- Row-level tenant isolation via `tenant_id` on every table.

### 5. Cache Layer
- **Redis 8.x** — for speed and async communication.
- Used for: metadata cache, JWT session, rate limit, job queue, pub/sub.

---

## Architectural Principles

| Principle | Rule |
|-----------|------|
| **Plugin First** | Core never imports plugin code. Plugins register via hooks. |
| **Metadata Driven** | Behavior declared in data, not in code. |
| **Event Driven** | All writes emit events. Side effects react asynchronously. |
| **Tenant Isolated** | `tenant_id` on every row. No cross-tenant query possible via standard API. |
| **Status Driven** | `status` is the single source of truth for document state. `is_deleted`/`is_locked` do not exist. |
| **Immutable Audit** | `sys_audit_log` is append-only. No UPDATE/DELETE ever. |
| **AI Friendly** | All metadata is structured JSON. All APIs have consistent patterns. |
| **Single Responsibility** | Each engine owns exactly one concern. |

---

## Data Flow for a Document Write

```
Browser
  └── POST /api/v1/doc/Customer
        │
        ▼
  [Gateway]
    1. Rate limit check
    2. JWT verify → extract user_id, tenant_id
    3. Attach req.user, req.tenant
        │
        ▼
  [API Engine] → routes to CRUD Engine
        │
        ▼
  [CRUD Engine]
    1. Load metadata (Metadata Engine)
    2. Check permission (Permission Engine)
    3. Lifecycle gate (Lifecycle Engine: canPerform?)
    4. Validate input (Zod schema from DocField metadata)
    5. Emit before_insert event (Event Engine)
    6. Execute INSERT (Database Engine)
    7. Emit after_insert event (Event Engine)
    8. Return result
        │
  [Event Engine] async subscribers:
    ├── Audit Engine → writes dt_customer_logs + sys_audit_log
    └── Version Engine → writes sys_doc_version snapshot
        │
        ▼
  Browser ← Response { success: true, data: {...} }
```

---

## Security Architecture

See `09-SECURITY/` for full security design. Summary:
- JWT (short-lived, 1h) + Refresh Token (7d, stored in httpOnly cookie).
- All routes require authentication except `/api/auth/login` and `/api/auth/refresh`.
- Permission checked per-route by Permission Engine.
- SQL injection prevented by parameterized queries (knex.js).
- XSS prevented by React's default escaping.
- CSRF prevented by same-site cookies + origin check.

---

## Scalability Considerations

| Concern | Solution |
|---------|---------|
| High traffic | Stateless Express + horizontal scaling behind load balancer |
| Metadata read performance | Redis cache — metadata rarely changes |
| Audit log growth | Separate `sys_audit_log` table; archive to cold storage after retention |
| Large DocType tables | Proper indexing (see 05-DATABASE); read replicas future-ready |
| Background jobs | Redis queue with worker processes |

---

## Notes

- This document is the **entry point** for understanding the system. All other documents in `04-TECHNICAL/` elaborate on individual sub-topics.
- When in doubt about where a piece of logic belongs, refer to the Architectural Principles table above.
- Each engine is documented in detail in `01-CORE/`.
