# 04-15 Logging Strategy

## Purpose

Documents the System Logging strategy in Framee. Logging here refers to recording system events to the console/file for debugging and operational purposes (DevOps/SRE) — **NOT** recording audit changes to user documents (that is the Audit Engine's responsibility, see `01-10-audit-engine.md`).

---

## 1. Logger Library (Winston)

Framee uses **Winston** (or Pino for extreme performance) as the logging standard.
`console.log` is **PROHIBITED** in production code, because it has no structured format, no log levels, and no timestamp context.

---

## 2. Log Levels

| Level | Purpose | When to Use |
|-------|---------|-------------|
| `ERROR` | Critical failure | `try/catch` fails, server crash, database connection drop, `SystemError` (500). Requires immediate ops attention. |
| `WARN` | Non-ideal but operational | API returns 401/403 (possible bot attack), queue retry, cache miss with fallback. |
| `INFO` | Normal operational events | API request completed (duration/status), server startup complete, metadata sync done. |
| `DEBUG` | Developer detail | Raw SQL queries being executed, parsed JSON payloads. **Disabled in production.** |

---

## 3. Log Formatting (Structured Logging)

In production, all logs MUST be formatted as **JSON** so they can be easily ingested by Log Aggregators (Datadog, ELK/Elasticsearch, CloudWatch).
In development, logs are formatted as colored text (CLI format) for human readability.

Example JSON Log in Production:
```json
{
  "level": "info",
  "message": "HTTP POST /api/v1/doc/Customer",
  "timestamp": "2026-07-13T10:15:30Z",
  "duration_ms": 142,
  "status_code": 201,
  "tenant_id": "t-indojaya",
  "user_id": "u-12345"
}
```

---

## 4. HTTP Request Logging

An Express Middleware (such as `morgan` or `winston-express`) is mounted right after routing.
HTTP logging rules:
1. Never log `req.body` if it contains passwords, credit card numbers, or PII (Personally Identifiable Information).
2. Always log: Method, URL, Status Code, Response Time (Latency), Tenant ID, User ID (if available).
3. If status code >= 500, log as `ERROR`. If >= 400, log as `WARN`. Otherwise `INFO`.

---

## 5. Storage & Log Rotation (Transports)

Framee is not responsible for retaining logs forever on disk. The application must follow the Twelve-Factor App methodology: logs are written to `stdout` / `stderr`.

- **Docker/Kubernetes/PM2**: Will capture `stdout` output and manage file rotation or forward it to a Log Aggregation Server.
- **File Fallback**: If writing to file is necessary (e.g., bare metal server without PM2), use `winston-daily-rotate-file` to split files per day (e.g., `framee-2026-07-13.log`) with a maximum of 14 days or 1GB.

---

## 6. Logger Usage Example in Code

```javascript
import logger from '../utils/logger.js';

// Inside Service Layer
async function syncExternalData(tenantId) {
  logger.info(`Starting external sync for tenant ${tenantId}`);
  
  try {
    const result = await apiCall();
    logger.debug('Sync result', { result }); // Only appears when NODE_ENV=development
  } catch (error) {
    logger.error('External sync failed', {
      tenantId,
      errMessage: error.message,
      stack: error.stack
    });
    throw new SystemError("External API is down.");
  }
}
```
