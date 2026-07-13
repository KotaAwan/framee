# 09-01 Security Overview

## Purpose

Documents the overall security architecture of Framee — how authentication, authorization, data isolation, input validation, and compliance are implemented to protect multi-tenant ERP data.

---

## 1. Security Principles

| Principle | Implementation |
|-----------|---------------|
| **Defense in Depth** | Multiple security layers: Gateway → Permission Engine → DB Layer. One layer failing does not expose data. |
| **Zero Trust** | Every request must be authenticated and authorized, even within the internal network. |
| **Least Privilege** | Users only receive permissions they explicitly need. Default is no access. |
| **Tenant Isolation** | No query can ever return data from a different tenant. `tenant_id` is mandatory on every row. |
| **Immutable Audit** | `sys_audit_log` is append-only. No UPDATE or DELETE ever. |
| **Fail Secure** | If authentication or authorization check fails, access is denied. If the system crashes, no data is exposed. |

---

## 2. Authentication

### JWT (JSON Web Token)
- **Access Token**: Short-lived (1 hour). Signed with `HS256` using `JWT_SECRET` env variable. Contains `user_id`, `tenant_id`, `roles`, `jti`.
- **Refresh Token**: Long-lived (7 days). Stored as `httpOnly; Secure; SameSite=Strict` cookie — never in localStorage.
- **Token Revocation**: JWT is stateless by nature, but Framee adds a revocation list in Redis (`framee:auth:blacklist:{jti}`). On logout, the JTI is added to the blacklist with TTL = remaining token lifetime.

### Password Policy
- Minimum 8 characters.
- Must include uppercase, lowercase, number, and special character (configurable per tenant via `sys_setting`).
- Stored as **Bcrypt hash** (cost factor ≥ 12). Never stored or logged in plaintext.
- Failed login attempts tracked. Account locked after N failures (configurable).

---

## 3. Authorization (Permission Engine)

### Role-Based Access Control (RBAC)
Every request to a DocType endpoint is checked against `sys_permission`:
1. Get user's roles from `sys_user_role`.
2. Merge permissions from all roles (most permissive wins).
3. Check the specific permission flag for the action (`can_read`, `can_write`, `can_create`, etc.).

### Field-Level Permission
For sensitive fields (e.g., `credit_limit`, `salary`), `perm_level > 0` permissions restrict which roles can see or edit specific fields. The CRUD Engine applies these restrictions when building the response.

### Document-Level Permission (Row-Level)
Some DocTypes support additional row-level restrictions (e.g., a user can only see Sales Orders they created). This is configured per DocType via metadata and enforced by the CRUD Engine's query builder.

---

## 4. Tenant Isolation

The first and most important security boundary in Framee is tenant isolation:

1. **JWT Enforcement**: `tenant_id` is extracted from the JWT payload on every request. It cannot be overridden by the client.
2. **Database Layer**: The `DatabaseEngine.query()` method always auto-appends `WHERE tenant_id = :tenantId` to every `dt_*` and `sys_*` query. This is done at the engine level and cannot be bypassed by service code.
3. **Metadata Isolation**: DocTypes, DocFields, Roles, and Permissions are all scoped to `tenant_id`.

---

## 5. Input Validation & SQL Injection

- **Schema Validation**: All incoming request bodies are validated against a Zod schema derived from `sys_docfield` metadata before any DB operation runs.
- **Parameterized Queries**: Knex.js query builder always uses parameterized queries. No string interpolation into SQL queries is permitted (see `06-07-database-rules.md`).
- **Output Sanitization**: React's default JSX rendering escapes all output. No `dangerouslySetInnerHTML` usage unless explicitly sanitized.

---

## 6. Transport Security

- **HTTPS Only**: The API must be served over HTTPS in staging and production environments. HTTP connections must redirect to HTTPS.
- **CORS**: Only whitelisted origins in `CORS_ALLOWED_ORIGINS` env variable. Requests from other origins are rejected.
- **Security Headers**: Express is configured with `helmet.js` to set standard security headers:
  - `Content-Security-Policy`
  - `Strict-Transport-Security`
  - `X-Content-Type-Options`
  - `X-Frame-Options`

---

## 7. Rate Limiting

- Rate limiting is enforced by `express-rate-limit` backed by a Redis store.
- Configuration (from `sys_setting` or env vars):
  - Default: 100 requests / 1 minute per IP
  - Auth endpoints (`/api/v1/auth/login`): 10 requests / 15 minutes per IP
  - Export endpoints: 5 requests / 5 minutes per user

---

## 8. Audit & Compliance

- Every write operation (Create, Update, Delete, Submit, Cancel) is recorded to `sys_audit_log` after it completes.
- `sys_audit_log` is append-only at the database user level (`REVOKE UPDATE, DELETE ON sys_audit_log`).
- Sensitive operations (login, logout, password change, permission change) are also logged.
- Log retention: Configurable per tenant (`AUDIT_LOG_RETENTION_DAYS`, default: 365).
