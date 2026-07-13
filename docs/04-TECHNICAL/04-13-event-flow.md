# 04-13 Event Flow

## Purpose

Documents how the Event-Driven Architecture is implemented in Framee using the Event Engine. Events decouple the primary process from side effects.

---

## 1. Synchronous vs Asynchronous Events

Framee distinguishes between two fundamentally different types of events:

### A. Sync Events (Hooks)
- Run **inside** the HTTP request flow.
- **Blocking** — the process waits until the hook completes.
- Can **abort** the process by throwing an Error.
- Prefix: `before_*` (e.g., `before_insert`, `before_update`, `before_submit`).
- **Use case:** Custom validation, mutating the payload before saving, checking quotas/limits.

### B. Async Events (Side Effects)
- Run **outside** the request flow (fire-and-forget).
- **Non-blocking** — the client receives a response immediately even if these events are still running in the background.
- **Cannot abort** the main process. If they error, the error is only logged.
- Prefix: `after_*` or past tense (e.g., `after_insert`, `submitted`, `cancelled`).
- **Use case:** Writing Audit Logs, sending Notifications, webhooks, stock sync.

---

## 2. Event Naming Convention

Event format: `{DocType}.{eventName}`.

Standard events from the CRUD Engine:
- `{DocType}.before_insert` (Sync)
- `{DocType}.after_insert` (Async)
- `{DocType}.before_update` (Sync)
- `{DocType}.after_update` (Async)
- `{DocType}.before_delete` (Sync)
- `{DocType}.after_delete` (Async)

Standard events from the Lifecycle Engine:
- `{DocType}.submitted` (Async)
- `{DocType}.cancelled` (Async)
- `{DocType}.locked` (Async)

Global System Events:
- `user.login` (Async)
- `user.logout` (Async)
- `meta.changed` (Async / PubSub)

---

## 3. Event Execution Flow

Flow for an HTTP `POST /api/v1/doc/SalesInvoice`:

```text
[Incoming HTTP Request]
      │
      ▼
1. JSON Schema Validation (Pass)
      │
      ▼
2. emitSync('SalesInvoice.before_insert')
   ├── Plugin A: Check discount (Pass)
   └── Plugin B: Add custom field value (Pass)
      │
      ▼
3. INSERT INTO dt_sales_invoice... (Database Transaction Commit)
      │
      ▼
4. Response sent to HTTP Client (201 Created)   <--- CLIENT DONE
      │
      ▼
5. emitAsync('SalesInvoice.after_insert')        <--- BACKGROUND STARTS
   ├── Audit Engine: Write sys_audit_log + dt_sales_invoice_logs
   ├── Notification Service: Send email to Manager
   └── Inventory Service: (No action)
```

---

## 4. Event Engine Implementation

The Event Engine is a simple Singleton in Framee that wraps Node.js `EventEmitter` (or a third-party library like `EventEmitter2` for wildcard support).

```javascript
// Registering a Listener (Inside a Plugin or Service)
eventEngine.onSync('SalesInvoice.before_insert', async (context) => {
  const { doc, tenantId, user } = context;
  if (doc.total < 0) throw new BusinessError("Total cannot be negative.");
});

// Emitting (Inside CRUDEngine)
async function executeInsert() {
  // Wait for all sync listeners. If any throws, it propagates up.
  await eventEngine.emitSync('SalesInvoice.before_insert', context);
  
  // Perform db insert...
  
  // Release async event without awaiting
  eventEngine.emitAsync('SalesInvoice.after_insert', context);
}
```

---

## 5. Event Context (Payload)

All event listeners receive a standard **context object** so they have complete information:

```json
{
  "doc": { "id": "...", "name": "...", "status": "Draft" },
  "originalDoc": { "id": "...", "status": "Draft" },
  "tenantId": "t-1234",
  "user": { "id": "u-999", "role": "Admin" },
  "trx": {}
}
```

`originalDoc` is only present on `update` / `delete` events.
The `trx` (database transaction object) is only available on `onSync` listeners, allowing them to add query operations to the running database transaction (so they roll back together if an error occurs).
