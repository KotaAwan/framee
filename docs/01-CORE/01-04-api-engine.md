# 01-04 API Engine

## Purpose

The API Engine is Framee's **dynamic REST API layer**. It is responsible for automatically generating and exposing REST API endpoints for every registered DocType, without requiring developers to write controller code for each one.

Beyond auto-generation, the API Engine serves as the unified gateway that all HTTP requests pass through — enforcing authentication, tenant context, rate limiting, and response formatting before any business logic is touched.

---

## Goals

1. Auto-generate REST API endpoints for every active DocType based on its metadata.
2. Serve as the central HTTP gateway — all requests enter the system through the API Engine.
3. Enforce authentication (JWT validation) on all protected routes.
4. Inject tenant context into every request from the JWT payload.
5. Apply rate limiting per tenant and per user to protect system resources.
6. Enforce a consistent API response envelope across all endpoints.
7. Provide API versioning to support backward-compatible evolution.
8. Expose API documentation derived from metadata for developer and AI consumption.

---

## Scope

### In Scope
- Express.js HTTP server setup and middleware registration
- JWT authentication middleware
- Tenant context injection middleware
- Rate limiting middleware
- Dynamic route registration for DocType CRUD endpoints
- Static route registration for system/meta/auth endpoints
- Request body validation middleware
- Standard response envelope formatting
- Error handling middleware (global catch)
- CORS policy enforcement
- API versioning (`/api/v1/`, `/api/v2/`)
- Plugin route registration

### Out of Scope
- Business logic execution (handled by CRUD Engine, services, plugins)
- Database access (handled by Database Engine)
- Permission enforcement (handled by Permission Engine, but invoked by API Engine middleware)
- Frontend rendering (handled by NextJS)
- Background job processing (future Queue Engine)

---

## Functional Requirements

### FR-001 Dynamic Route Generation
- On startup, the API Engine must query all active DocTypes from the Metadata Engine and register standard CRUD routes for each one.
- When a new DocType is created or activated at runtime, the API Engine must register its routes without a server restart.

### FR-002 JWT Authentication
- Every request to a non-public endpoint must carry a valid Bearer JWT token in the `Authorization` header.
- On invalid or expired token, the engine must return `401 Unauthorized`.
- The JWT payload must include `user_id`, `tenant_id`, `roles`, and `session_id`.

### FR-003 Tenant Context
- After JWT validation, the engine must extract `tenant_id` from the token and attach it to the request context.
- All downstream engines receive tenant context from this attachment — never from the request body.

### FR-004 Rate Limiting
- Rate limits are enforced per `(tenant_id, user_id)` combination.
- Default: 300 requests per minute per user.
- Exceeded rate limit returns `429 Too Many Requests` with a `Retry-After` header.
- System Manager users have higher rate limits configurable per tenant.

### FR-005 Response Envelope
- All responses must be wrapped in the standard Framee response envelope.
- No raw data responses are permitted from any endpoint.

### FR-006 API Versioning
- All routes must be prefixed with `/api/v{N}/`.
- Current active version: `/api/v1/`.
- A deprecated version must serve responses with a `Deprecation` response header indicating the sunset date.

### FR-007 CORS
- Allowed origins are configurable per environment.
- Wildcard `*` CORS is forbidden in production.
- Preflight `OPTIONS` requests must be handled correctly.

### FR-008 Plugin Routes
- Plugins can register their own routes via the plugin registry at startup.
- Plugin routes are namespaced under `/api/v1/plugin/{plugin-name}/`.

### FR-009 Public Endpoint Whitelist
- A configurable whitelist of endpoint paths that bypass JWT authentication (e.g., login, health check, public metadata).

---

## Architecture

```
HTTP Request
    │
    ▼
┌────────────────────────────────────────────────────────┐
│                    API Engine                           │
│                                                         │
│  ┌─────────┐  ┌────────┐  ┌────────────┐  ┌────────┐  │
│  │  CORS   │  │ Helmet │  │Rate Limiter│  │Compress│  │
│  │Middleware│  │Security│  │(Redis)     │  │-ion    │  │
│  └────┬────┘  └───┬────┘  └─────┬──────┘  └───┬────┘  │
│       └───────────┴─────────────┴──────────────┘        │
│                          │                               │
│  ┌───────────────────────▼──────────────────────────┐   │
│  │              Auth Middleware (JWT)                 │   │
│  │  Validate Token → Extract user/tenant/roles        │   │
│  └───────────────────────┬──────────────────────────┘   │
│                          │                               │
│  ┌───────────────────────▼──────────────────────────┐   │
│  │           Tenant Context Middleware                │   │
│  │  Attach tenant_id to req.context                  │   │
│  └───────────────────────┬──────────────────────────┘   │
│                          │                               │
│  ┌───────────────────────▼──────────────────────────┐   │
│  │              Router Layer                          │   │
│  │  /api/v1/auth/*    → Auth Routes                  │   │
│  │  /api/v1/meta/*    → Meta Routes                  │   │
│  │  /api/v1/doc/*     → Dynamic DocType Routes       │   │
│  │  /api/v1/system/*  → System Routes                │   │
│  │  /api/v1/plugin/*  → Plugin Routes                │   │
│  └───────────────────────┬──────────────────────────┘   │
│                          │                               │
│  ┌───────────────────────▼──────────────────────────┐   │
│  │         Permission Middleware                      │   │
│  │  Check role permission for route + action         │   │
│  └───────────────────────┬──────────────────────────┘   │
│                          │                               │
│  ┌───────────────────────▼──────────────────────────┐   │
│  │         Route Handler → Engine Call               │   │
│  │  CRUD Engine | Auth Service | Meta Engine         │   │
│  └───────────────────────┬──────────────────────────┘   │
│                          │                               │
│  ┌───────────────────────▼──────────────────────────┐   │
│  │         Response Formatter                         │   │
│  │  Wrap in { success, data, meta, error }           │   │
│  └───────────────────────┬──────────────────────────┘   │
│                          │                               │
│  ┌───────────────────────▼──────────────────────────┐   │
│  │         Error Handler Middleware                   │   │
│  │  Catch all unhandled errors, format, log          │   │
│  └──────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────┘
                          │
                    HTTP Response
```

---

## Database Design

The API Engine itself does not have dedicated database tables. It uses:
- `sys_rate_limit` in Redis (not MySQL) for rate limit counters
- `sys_api_log` (optional) for API access logging

### Optional: `sys_api_log` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | VARCHAR(36) | UUID PK |
| `tenant_id` | VARCHAR(36) | Tenant reference |
| `user_id` | VARCHAR(36) | Requesting user |
| `method` | VARCHAR(10) | HTTP method |
| `path` | VARCHAR(500) | Request path |
| `status_code` | SMALLINT | HTTP response code |
| `duration_ms` | INT | Request processing time |
| `ip_address` | VARCHAR(45) | Client IP |
| `created_at` | DATETIME | Timestamp |

### Indexes

```sql
INDEX idx_api_log_tenant_user (tenant_id, user_id)
INDEX idx_api_log_created (tenant_id, created_at)
INDEX idx_api_log_status (status_code)
```

---

## API Design

### Standard Response Envelope

**Success:**
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "total": 100,
    "page": 1,
    "pageSize": 20
  }
}
```

**Error:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable error message",
    "fields": {
      "field_name": "Field-specific error"
    }
  }
}
```

### Standard HTTP Status Codes

| Code | Meaning | Used For |
|------|---------|---------|
| `200` | OK | Successful GET, PUT |
| `201` | Created | Successful POST (create) |
| `204` | No Content | Successful DELETE |
| `400` | Bad Request | Malformed request body |
| `401` | Unauthorized | Missing or invalid JWT |
| `403` | Forbidden | Valid JWT but insufficient permission |
| `404` | Not Found | Record or DocType not found |
| `409` | Conflict | Duplicate record / submitted doc edit |
| `422` | Unprocessable | Validation errors |
| `429` | Too Many Requests | Rate limit exceeded |
| `500` | Internal Server Error | Unhandled server error |

### Auth Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/auth/login` | Authenticate user, return tokens |
| `POST` | `/api/v1/auth/logout` | Invalidate refresh token |
| `POST` | `/api/v1/auth/refresh` | Exchange refresh token for new access token |
| `GET` | `/api/v1/auth/me` | Get current user profile |

### System Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/system/health` | Health check (public) |
| `GET` | `/api/v1/system/info` | Framework version and config summary |
| `GET` | `/api/v1/system/routes` | List all registered routes (admin only) |

### Dynamic DocType Endpoints (Auto-Generated)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/doc/:doctype` | List records |
| `POST` | `/api/v1/doc/:doctype` | Create record |
| `GET` | `/api/v1/doc/:doctype/:id` | Get single record |
| `PUT` | `/api/v1/doc/:doctype/:id` | Update record |
| `DELETE` | `/api/v1/doc/:doctype/:id` | Soft delete record |
| `POST` | `/api/v1/doc/:doctype/:id/submit` | Submit document |
| `POST` | `/api/v1/doc/:doctype/:id/cancel` | Cancel document |

---

## UI Behaviour

The API Engine is a backend component. Its UI-facing behavior is:

- **All frontend API calls** go to the API Engine.
- **401 responses** trigger the frontend to redirect to the login page.
- **429 responses** show a "Too many requests" toast notification.
- **403 responses** show an "Access Denied" screen.
- **422 responses** map validation errors back to form fields.

---

## Configuration

| Config Key | Default | Description |
|------------|---------|-------------|
| `API_PORT` | `3001` | HTTP server port |
| `API_BASE_PATH` | `/api/v1` | Base route prefix |
| `API_RATE_LIMIT_RPM` | `300` | Requests per minute per user |
| `API_RATE_LIMIT_ADMIN_RPM` | `1000` | Rate limit for System Manager |
| `CORS_ALLOWED_ORIGINS` | — | Comma-separated list of allowed origins |
| `JWT_SECRET` | — | JWT signing secret (env var) |
| `JWT_EXPIRES_IN` | `15m` | Access token expiry |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Refresh token expiry |
| `API_LOG_ENABLED` | `false` | Enable API access logging to DB |
| `API_PUBLIC_PATHS` | `/api/v1/system/health,/api/v1/auth/login` | Comma-separated whitelist of public paths |

---

## Validation Rules

- All request bodies must be valid JSON. Non-JSON bodies are rejected with 400.
- `Content-Type: application/json` is required for POST and PUT requests.
- Pagination parameters: `page` must be ≥ 1; `pageSize` must be between 1 and `API_MAX_PAGE_SIZE`.
- Sort parameter format: `?sort=fieldname:asc` or `?sort=fieldname:desc`. Invalid sort fields are rejected.
- Filter parameter format: `?filters[fieldname]=value`. Only DocField-defined fields are accepted as filter keys.
- DocType name in the route must exist in the metadata registry. Non-existent DocTypes return 404.

---

## Security

### Authentication
- All non-whitelisted endpoints require a valid `Bearer` JWT token.
- Expired tokens return 401 with `{ code: "TOKEN_EXPIRED" }` to distinguish from invalid tokens.
- Token refresh blacklist is maintained in Redis to support explicit logout and token revocation.

### Authorization
- After authentication, the Permission Middleware checks if the user's roles permit the requested action on the target DocType.
- Field-level permissions are enforced in the response serializer — restricted fields are excluded from the response.

### Rate Limiting
- Rate limit state is stored in Redis with sliding window counters.
- IP-based rate limiting for unauthenticated endpoints (login, public health check).

### Security Headers (Helmet.js)
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Strict-Transport-Security` (production only)
- `Content-Security-Policy` (configurable)
- `X-XSS-Protection`

### Input Sanitization
- Request bodies are validated by the Validate Middleware before reaching route handlers.
- Dangerous characters in filter/sort query parameters are sanitized before being passed to the Database Engine.

---

## Events

### Emitted Events

| Event | Payload | Trigger |
|-------|---------|---------|
| `api.request` | `{ method, path, tenant_id, user_id }` | Every incoming request |
| `api.response` | `{ status_code, duration_ms, path }` | Every completed response |
| `api.error` | `{ code, path, error_message }` | Any unhandled error |
| `api.rate_limited` | `{ user_id, tenant_id, path }` | Rate limit exceeded |
| `api.route_registered` | `{ doctype, routes[] }` | Dynamic route registered |

### Listened Events

| Event | Action |
|-------|--------|
| `metadata.reloaded` | Re-register dynamic routes for updated DocTypes |
| `plugin.registered` | Register plugin routes into Express router |

---

## Performance

### Response Compression
- All responses larger than 1KB are compressed with gzip via the `compression` middleware.

### Rate Limiting Efficiency
- Rate limit counters use Redis atomic increment operations — no locking, no race conditions.
- Redis Sorted Sets are used for sliding window rate limiting.

### Route Registration
- Dynamic routes are registered once at startup and cached in Express's route table.
- Hot reload of a single DocType's routes (when metadata changes) uses Express's `Router` instance swap without restarting the server.

### API Logging
- API access logging is asynchronous — log writes do not block the response.
- In production, only error and rate-limit events are logged by default. Full access logging is opt-in.

---

## Future Improvements

- **GraphQL API** — An additive GraphQL layer alongside REST, auto-generated from DocType metadata.
- **WebSocket Endpoint** — Real-time event subscription channel for connected clients.
- **API Key Authentication** — Token-based auth for server-to-server integration without user sessions.
- **OpenAPI Spec Generation** — Auto-generate OpenAPI 3.0 YAML from DocType metadata for developer portals.
- **API Gateway Integration** — Support deployment behind AWS API Gateway or Kong for advanced traffic management.
- **Request Replay** — Log and replay failed requests for debugging in development environments.

---

## Acceptance Criteria

- [ ] `GET /api/v1/system/health` returns `200 OK` with no authentication required.
- [ ] `POST /api/v1/auth/login` returns a valid JWT on correct credentials.
- [ ] Any non-whitelisted endpoint with no Authorization header returns `401`.
- [ ] Any non-whitelisted endpoint with an expired token returns `401` with `code: TOKEN_EXPIRED`.
- [ ] After login, calling `POST /api/v1/auth/refresh` returns a new access token.
- [ ] `GET /api/v1/doc/Customer` is auto-registered when the `Customer` DocType is active.
- [ ] Dynamic routes for a newly created DocType appear without server restart.
- [ ] Exceeding 300 requests/minute returns `429 Too Many Requests` with a `Retry-After` header.
- [ ] A plugin route registered under `/api/v1/plugin/myplugin/` is reachable after plugin load.
- [ ] All successful responses use the standard `{ success, data, meta }` envelope.
- [ ] All error responses use the standard `{ success, error: { code, message } }` envelope.
- [ ] CORS rejects requests from origins not in `CORS_ALLOWED_ORIGINS`.
- [ ] All responses include Helmet.js security headers.

---

## Notes

- The API Engine is the **only entry point** for external HTTP traffic. Internal engine-to-engine communication does not go through HTTP — it goes through direct function calls.
- Dynamic route registration is powered by Express's modular `Router`. Each DocType gets its own Router instance mounted at `/api/v1/doc/:doctype`. This allows clean route-level middleware attachment.
- Public endpoints (health check, login) must be explicitly declared in the whitelist config. The default posture is **deny all unauthenticated**.
- The API Engine version is tied to the Framee framework version. Plugin routes inherit the framework's API version namespace. Plugins that need to introduce breaking API changes must coordinate with the core team for a version bump.
