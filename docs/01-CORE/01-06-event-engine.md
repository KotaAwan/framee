# 01-06 Event Engine

## Purpose

The Event Engine is Framee's **internal event bus**. It enables decoupled, asynchronous communication between engines, modules, services, and plugins through a publish-subscribe (pub/sub) pattern.

Without the Event Engine, cross-cutting concerns — such as audit logging, cache invalidation, notification sending, or workflow triggers — would require direct coupling between modules. The Event Engine eliminates that coupling: a module publishes an event, and any number of listeners react to it independently.

This is the foundational mechanism that makes Framee's Plugin First architecture possible. Plugins extend system behavior by listening to events — not by modifying core code.

---

## Goals

1. Provide a reliable, in-process event bus for synchronous and asynchronous event dispatch.
2. Enable complete decoupling between event publishers and event subscribers.
3. Allow plugins to subscribe to any core or domain event without modifying the publishing module.
4. Guarantee event delivery ordering within a single request context.
5. Provide a structured event log for observability, audit, and replay.
6. Support wildcard subscriptions for cross-cutting concerns (e.g., "listen to all after_insert events").
7. Ensure that errors in one subscriber do not prevent other subscribers from receiving the event.

---

## Scope

### In Scope
- In-process event bus (synchronous and async subscriber execution)
- Event registration (subscribe, unsubscribe)
- Event dispatch (emit, emit-async)
- Wildcard event pattern matching
- Subscriber isolation (errors in one subscriber do not propagate to others)
- Event logging to `sys_event_log`
- Before-event cancellation support (subscribers can abort an operation)
- Plugin hook registration into the event bus

### Out of Scope
- Distributed message queues (Kafka, RabbitMQ) — future Queue Engine
- Cross-process event delivery — handled via Redis Pub/Sub at the Cache Engine level for invalidation
- Scheduled/recurring events — future Scheduler Engine
- External webhook delivery — future Webhook Engine

---

## Functional Requirements

### FR-001 Subscribe and Emit
- Any module or plugin can subscribe to a named event with a handler function.
- Any engine or service can emit a named event with a payload.
- Multiple subscribers to the same event all receive it.

### FR-002 Before Event Cancellation
- Handlers subscribed to `before_*` events may throw an error to cancel the originating operation.
- The CRUD Engine must respect cancellations from before-event handlers.

### FR-003 After Event Isolation
- Handlers subscribed to `after_*` events run in isolation.
- If one handler throws, others still execute.
- Handler errors are logged but do not fail the original operation.

### FR-004 Async Handlers
- Handlers may be synchronous or asynchronous (Promise-returning).
- The engine must await async handlers appropriately without blocking the request cycle.
- Before-event handlers are always awaited (blocking). After-event handlers may be non-blocking (fire-and-forget with error capture).

### FR-005 Wildcard Subscriptions
- Subscriptions can use wildcards: `*.after_insert` (all after_insert events), `Customer.*` (all Customer events).
- Wildcard matching uses glob-style pattern matching.

### FR-006 Event Logging
- All emitted events are logged to `sys_event_log` with the event name, payload summary, tenant ID, user ID, and timestamp.
- Event logging is asynchronous and non-blocking.

### FR-007 Plugin Hook Registration
- Plugins register their event handlers via the plugin registry at startup.
- Handler registration is validated: the handler must be a function; the event name must be a non-empty string.

### FR-008 Priority Ordering
- Subscribers can specify a `priority` number (default: 10). Lower numbers execute first.
- This allows core framework handlers to execute before plugin handlers on the same event.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                       Event Engine                            │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                 Subscriber Registry                   │   │
│  │  Map<eventName, Handler[]>  (sorted by priority)     │   │
│  └────────────────────────────┬─────────────────────────┘   │
│                               │                              │
│  ┌────────────────────────────▼─────────────────────────┐   │
│  │                 Dispatcher                            │   │
│  │                                                       │   │
│  │  emit(event, payload)                                │   │
│  │  ├─ Is before_* event?                               │   │
│  │  │    ├─ Await handlers sequentially                 │   │
│  │  │    └─ Any throw → cancel and propagate error      │   │
│  │  └─ Is after_* event?                                │   │
│  │       ├─ Run handlers in parallel                    │   │
│  │       └─ Catch and log handler errors individually   │   │
│  └────────────────────────────┬─────────────────────────┘   │
│                               │                              │
│  ┌────────────────────────────▼─────────────────────────┐   │
│  │               Event Logger                            │   │
│  │  Write to sys_event_log (async, non-blocking)         │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘

Publishers: CRUD Engine, API Engine, Metadata Engine, Plugin Services
Subscribers: Cache Engine, Audit Service, Notification Service, Plugins
```

### Event Naming Convention

```
{doctype}.{lifecycle_action}        → Customer.after_insert
{engine}.{action}                   → metadata.reloaded
{system}.{event}                    → system.boot
{plugin_name}.{event}               → hr_plugin.payslip_generated
```

---

## Database Design

### `sys_event_log` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | VARCHAR(36) | UUID PK |
| `tenant_id` | VARCHAR(36) | Tenant reference |
| `event_name` | VARCHAR(200) | Full event name |
| `publisher` | VARCHAR(100) | Source engine or service |
| `payload_summary` | JSON | Truncated payload for debugging (no PII) |
| `subscriber_count` | INT | Number of handlers that received the event |
| `user_id` | VARCHAR(36) | User context at emit time |
| `doc_id` | VARCHAR(36) | Related document ID (if applicable) |
| `doctype` | VARCHAR(100) | Related DocType (if applicable) |
| `duration_ms` | INT | Total handler execution time |
| `had_errors` | TINYINT(1) | Whether any handler threw an error |
| `created_at` | DATETIME | Event timestamp |

### Indexes

```sql
INDEX idx_event_tenant_name (tenant_id, event_name)
INDEX idx_event_tenant_doc (tenant_id, doctype, doc_id)
INDEX idx_event_created (tenant_id, created_at)
INDEX idx_event_errors (had_errors, created_at)
```

---

## API Design

### Internal Engine API (Programmatic)

```
// Subscribe to an event
events.on(eventName, handler, { priority: 10 })
events.on('Customer.after_insert', async (payload, context) => { ... })
events.on('*.after_insert', async (payload, context) => { ... })  // wildcard

// Unsubscribe (used during plugin unload)
events.off(eventName, handler)

// Emit an event
await events.emit(eventName, payload, context)
// Returns: { cancelled: boolean, errors: Error[] }

// Check if any handler is registered
events.hasListeners(eventName)
→ boolean

// List all registered events and subscriber counts
events.listEvents()
→ [{ event, subscriberCount, handlers[] }]
```

### REST API (Admin/Debug)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/system/events` | List all registered event subscriptions |
| `GET` | `/api/v1/system/event-log` | Query event log (paginated) |
| `GET` | `/api/v1/system/event-log?event=Customer.after_insert` | Filter by event name |
| `GET` | `/api/v1/system/event-log?had_errors=1` | Filter for events with handler errors |

---

## UI Behaviour

_The Event Engine is a backend infrastructure component with no direct UI._

Admin developers can view event logs via the System Settings section, which displays a paginated event log table. This is primarily a debugging and observability tool.

---

## Configuration

| Config Key | Default | Description |
|------------|---------|-------------|
| `EVENT_LOG_ENABLED` | `true` | Enable event logging to `sys_event_log` |
| `EVENT_LOG_TTL_DAYS` | `30` | Retain event logs for this many days |
| `EVENT_ASYNC_AFTER_HANDLERS` | `true` | Run after_* handlers as fire-and-forget |
| `EVENT_MAX_HANDLER_TIMEOUT_MS` | `5000` | Max allowed time for a single handler |
| `EVENT_LOG_PAYLOAD_MAX_BYTES` | `1024` | Max bytes of payload stored in log |

---

## Validation Rules

- Event names must follow the naming convention: alphanumeric, dots, and underscores only.
- Event names must not be empty strings.
- Handler must be a function (sync or async). Non-function registrations are rejected.
- Priority must be a positive integer between 1 and 100.
- Payload must be a serializable object. Non-serializable payloads are rejected.
- `before_*` events that have no subscribers still proceed normally (not blocked by absence of handlers).

---

## Security

- Event handlers in plugins run with the same tenant context as the emitting operation. A plugin cannot escalate privileges via an event handler.
- Sensitive fields (passwords, tokens, secrets) must not be included in event payloads. Publishers are responsible for sanitizing payloads before emission.
- The event log (`sys_event_log`) does not store raw field values — only a summarized, truncated JSON is stored.
- The admin event log API endpoint requires System Manager role.
- Plugin handlers are sandboxed to the extent possible — unhandled exceptions in plugin handlers are caught and isolated.

---

## Events

### System Events (Emitted by the Event Engine itself)

| Event | Payload | Trigger |
|-------|---------|---------|
| `event_engine.ready` | `{ subscriber_count }` | Engine initialized |
| `event_engine.handler_error` | `{ event, plugin, error_message }` | A handler threw an error |
| `event_engine.slow_handler` | `{ event, handler, duration_ms }` | Handler exceeded timeout |

### Core CRUD Events (Emitted by CRUD Engine, subscribed to by plugins)

| Pattern | Example |
|---------|---------|
| `{DocType}.before_insert` | `Customer.before_insert` |
| `{DocType}.after_insert` | `Customer.after_insert` |
| `{DocType}.before_update` | `Customer.before_update` |
| `{DocType}.after_update` | `Customer.after_update` |
| `{DocType}.before_delete` | `Customer.before_delete` |
| `{DocType}.after_delete` | `Customer.after_delete` |
| `{DocType}.after_submit` | `SalesOrder.after_submit` |

---

## Performance

### Handler Execution Model
- `before_*` handlers run sequentially to guarantee ordering and cancellation support.
- `after_*` handlers run in parallel (Promise.allSettled) to minimize total handler time.
- Each handler has a configurable timeout (default 5000ms) after which it is considered failed.

### Event Log Writes
- Event log writes are batched and flushed asynchronously every 100ms or when the batch reaches 50 events — whichever comes first.
- This prevents individual event log writes from adding latency to the main request path.

### Subscriber Registry
- The subscriber registry is an in-memory Map, providing O(1) lookup for exact event names.
- Wildcard matching uses a pre-compiled glob matcher and runs in O(n) where n is the number of registered patterns.

### Log Pruning
- `sys_event_log` is pruned by a scheduled job that removes logs older than `EVENT_LOG_TTL_DAYS`.
- Pruning runs during low-traffic hours to minimize database load.

---

## Future Improvements

- **Distributed Event Bus** — Redis Streams or Kafka-backed event bus for cross-service event delivery in microservices deployments.
- **Event Replay** — Admin tool to replay historical events for debugging or re-processing.
- **Dead Letter Queue** — Capture events where all handlers failed for manual review and retry.
- **Event Schema Validation** — Enforce a JSON Schema on event payloads for type safety.
- **Webhook Delivery** — Convert events to HTTP webhooks for external system integration.
- **Event Visualization** — Admin UI showing event flow diagrams between engines and plugins.

---

## Acceptance Criteria

- [ ] Subscribing to `Customer.after_insert` with a handler causes the handler to be called every time a Customer is created.
- [ ] Multiple handlers subscribed to `Customer.after_insert` all receive the event.
- [ ] A handler subscribed to `Customer.before_insert` that throws causes the create operation to be cancelled with the handler's error message.
- [ ] A handler subscribed to `Customer.after_insert` that throws does NOT prevent other handlers from receiving the event.
- [ ] A wildcard subscription `*.after_insert` receives events from all DocTypes' after_insert emissions.
- [ ] Priority ordering is respected: a handler with priority=1 executes before a handler with priority=10.
- [ ] All emitted events are recorded in `sys_event_log` with correct event name, tenant, and timestamp.
- [ ] `events.listEvents()` returns all registered events with their subscriber counts.
- [ ] A plugin can register a handler at startup and receive events without core code modification.
- [ ] Removing a plugin unregisters all its handlers from the event bus.
- [ ] A slow handler (exceeding `EVENT_MAX_HANDLER_TIMEOUT_MS`) emits `event_engine.slow_handler` and logs a warning.

---

## Notes

- The Event Engine is **in-process only** for the initial release. Distributed event delivery (across multiple server processes) is a future concern and will be implemented via a Queue Engine backed by Redis Streams or a similar mechanism.
- The Event Engine is not a general-purpose message queue. It is designed for low-latency, in-process event dispatch. Heavy workloads triggered by events (e.g., sending 10,000 emails) must be offloaded to a background worker, not executed inline in the handler.
- `before_*` events are the framework's primary extension point for validation and data enrichment. `after_*` events are for side effects (notifications, cache invalidation, audit logging). This distinction must be understood by all plugin developers.
- AI agents generating plugin code should be informed that event handlers are the correct way to extend CRUD behavior without modifying core files.
