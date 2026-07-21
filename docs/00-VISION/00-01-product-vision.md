# 00-01 Product Vision

## Purpose

Framee is a **Metadata Driven ERP Framework** designed to enable rapid development of enterprise-grade business applications. It exists to eliminate repetitive low-level coding through a declarative, configuration-first approach where business logic, forms, APIs, and workflows are derived from metadata definitions rather than hand-written code.

The framework provides a standardized foundation that can power any vertical ERP domain — including Finance, HR, Procurement, Inventory, CRM, and beyond — through a Plugin First architecture that keeps the core lightweight and extensible.

---

## Goals

1. **Accelerate ERP Development** — Reduce time-to-market by allowing non-repetitive, metadata-driven module creation rather than custom coding per feature.
2. **Enable Plugin First Extensibility** — Allow third-party plugins and internal modules to extend the system without modifying core code.
3. **Provide AI-Friendly Structure** — Expose metadata, events, and APIs in a format that AI agents can read, generate, and interact with natively.
4. ~~**Support Multi-Tenancy**~~ — ~~Enable SaaS deployment where multiple organizations share one platform instance with complete data isolation.~~ **[DEPRECATED: Multi-tenancy is no longer used in Framee. Single-tenant deployment only.]**
5. **Ensure Enterprise-Grade Security** — Role-based access control, field-level permissions, and audit trails built into the framework core.
6. **Maximize Developer Productivity** — Provide clear abstractions, consistent patterns, and tooling that allow developers to build reliable ERP features efficiently.
7. **Support Mobile First** — Ensure the frontend and API layer are designed for mobile-responsive, progressive interactions from day one.

---

## Scope

### In Scope

- Core framework engine (Metadata, CRUD, API, Cache, Events, Permissions, Workflow, Document Lifecycle, Audit, Version)
- System configuration layer (Modules, DocTypes, DocFields, Menus, Roles, Users)
- Frontend foundation (NextJS architecture, Dynamic Forms, Dynamic Lists, Dynamic Layouts)
- REST API layer auto-generated from metadata
- Plugin registration and lifecycle management
- ~~Multi-tenant data isolation at the row level~~ **[DEPRECATED]**
- Redis-based caching for metadata and frequently accessed records
- Event system for inter-module and plugin communication
- AI-friendly metadata exposure and structured event logging

### Out of Scope

- Domain-specific ERP modules (Finance, HR, Procurement, etc.) — these are delivered as plugins on top of the framework
- Mobile native applications (iOS/Android) — only mobile-responsive web is in scope
- Third-party integrations (e.g., payment gateways, shipping APIs) — delivered as separate plugins
- Infrastructure provisioning and deployment tooling — outside the framework boundary

---

## Functional Requirements

### FR-001 Metadata Engine
- The system must allow all DocTypes, DocFields, and module configurations to be defined as metadata records in the database.
- Metadata must be cacheable and hot-reloadable without server restart.

### FR-002 Dynamic CRUD
- The system must auto-generate Create, Read, Update, Delete operations for any DocType without custom controller code.
- CRUD behavior must be configurable per DocType (e.g., soft delete, audit trail, versioning).

### FR-003 API Auto-Generation
- Every DocType registered in the system must automatically expose standard REST API endpoints.
- API behavior (filtering, pagination, field visibility) must be driven by metadata and permissions.

### FR-004 Plugin System
- Plugins must be able to register new Modules, DocTypes, Hooks, Events, and UI components without modifying core files.
- Plugins must declare a manifest that describes their capabilities, dependencies, and version compatibility.

### FR-005 Workflow Engine
- The system must support configurable multi-step approval workflows attached to any DocType.
- Workflow states and transitions must be metadata-driven.

### FR-006 Permission Engine
- Access control must support Role-based permissions at the DocType level.
- Fine-grained permissions must support field-level read/write control per Role.

### FR-007 Event Engine
- The system must emit lifecycle events (before_insert, after_insert, before_update, after_update, before_delete, after_delete) for all DocType operations.
- Plugins and modules must be able to subscribe to events without modifying core code.

### FR-008 ~~Multi-Tenancy~~ [DEPRECATED]

> **This requirement is no longer active. Framee runs in single-tenant mode. The `tenant_id` column is not used in the current implementation. All database queries operate without tenant scoping.**

- ~~All records must carry a `tenant_id` field.~~
- ~~All queries must be automatically scoped to the active tenant context.~~

### FR-009 AI Integration
- Metadata must be exportable as structured JSON for AI agent consumption.
- APIs must support AI-friendly patterns such as natural language query hints in schema descriptions.

### FR-010 Document Lifecycle
- Every document must have a `status` field (Draft, Submitted, Locked, Cancelled, Archived, Deleted).
- `is_deleted` and `is_locked` flags are retired. Status is the single source of truth for document state.
- DocTypes declare their own lifecycle behavior via metadata (`allow_cancel`, `allow_amend`, `lock_on_submit`, etc.).

### FR-011 Audit Trail
- All create, update, status transition, login, and permission-change operations must be logged with user identity, IP, timestamp, tenant, and field-level diff.
- Audit records are immutable — no update or delete permitted.

### FR-012 Version History
- Every DocType with `track_changes = true` must maintain a complete snapshot history.
- Users can browse version history, compare any two versions, and restore to a prior version (subject to lifecycle rules).

---

## Architecture

Framee is structured as a layered architecture:

```
┌────────────────────────────────────────────────────────┐
│                   Frontend (NextJS)                    │
│        Dynamic Forms | Dynamic Lists | Layouts         │
└──────────────────────────┬─────────────────────────────┘
                           │ REST API
┌──────────────────────────▼─────────────────────────────┐
│                  API Engine (ExpressJS)                │
│              Auth | Routing | Rate Limit               │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│                    Core Engines                        │
│  Metadata  │  CRUD  │  Cache  │  Event  │  API         │
│  Permission │ Workflow │ DocLifecycle │ Audit │ Version│
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│               Database Layer (MySQL)                   │
│                Single-Tenant | Indexes                 │
└────────────────────────────────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│                  Cache Layer (Redis)                   │
│        Metadata Cache | Session | Rate Limit           │
└────────────────────────────────────────────────────────┘
```

### Key Architectural Principles

| Principle               | Description                                                                  |
|-------------------------|------------------------------------------------------------------------------|
| Plugin First            | Core never imports plugin code; plugins register themselves                  |
| Metadata Driven         | Behavior is declared, not coded                                              |
| Event Driven            | All operations publish events; plugins react asynchronously                  |
| AI Friendly             | Metadata and events are machine-readable and well-structured                 |
| ~~Multi-Tenant Ready~~  | ~~Tenant context flows through all layers automatically~~ **[DEPRECATED]**  |
| Mobile First            | APIs and UI components designed for mobile breakpoints first                 |
| Audit by Default.       | Every write is audited automatically — no developer action required.         |
| Immutable History       | Submitted/Locked documents cannot be silently edited — amendment is the path |
| Status-Driven Lifecycle | `status` field replaces `is_deleted`/`is_locked` — all state in one place.   |

---

## Database Design

### Core Tables

| Table                     |                                                             Purpose |
|---------------------------|---------------------------------------------------------------------|
| `sys_module`              | Registered ERP modules                                              |
| `sys_doctype`             | Registered document types                                           |
| `sys_docfield`            | Fields per DocType                                                  |
| `sys_role`                | Roles for access control                                            |
| `sys_user`                | Platform users                                                      |
| `sys_user_role`           | User-to-role mapping                                                |
| `sys_permission`          | Role-level DocType permissions                                      |
| `sys_menu`                | Navigation menu definitions                                         |
| `sys_workflow`            | Workflow definitions                                                |
| `sys_workflow_state`.     | Workflow state nodes                                                |
| `sys_workflow_transition` | State transition rules                                              |
| `sys_workflow_history`    | Workflow transition records                                         |
| `sys_audit_log`           | Global immutable audit trail (compliance, forensics)                |
| `dt_{doctype}_logs`       | Local activity log per DocType (Activity Timeline, Comments, Likes) |
| `dt_{doctype}_likes`      | Per-user likes per DocType record                                   |
| `sys_doc_version`         | Document version snapshots                                          |
| `sys_lifecycle_status`    | Valid lifecycle status values                                       |

### Common Fields (All `dt_*` Document Tables)

> **`is_deleted` and `is_locked` are retired.** The `status` field is the single source of truth.
> **`tenant_id` is also no longer actively used.** Framee operates in single-tenant mode.

```
id              VARCHAR(36)  PK, UUID (or auto-increment INT in current impl)
status          VARCHAR(20)  NOT NULL DEFAULT 'Draft'
created_by      VARCHAR(36)  FK → sys_user.id
updated_by      VARCHAR(36)  FK → sys_user.id
created_at      DATETIME     DEFAULT CURRENT_TIMESTAMP
updated_at      DATETIME     ON UPDATE CURRENT_TIMESTAMP
deleted_at      DATETIME     NULL
deleted_by      VARCHAR(36)  NULL
delete_reason   TEXT         NULL
amended_from    VARCHAR(36)  NULL
submitted_at    DATETIME     NULL
submitted_by    VARCHAR(36)  NULL
cancelled_at    DATETIME     NULL
cancelled_by    VARCHAR(36)  NULL
cancel_reason   TEXT         NULL
```

### Indexes
- All tables: standard indexes on `status` and `created_at`
- ~~`(tenant_id, is_deleted)` composite index~~ **[DEPRECATED — no multi-tenant indexing]**
- `sys_doctype`: `name` unique index
- `sys_docfield`: `(doctype_id, fieldname)` unique index

---

## API Design

All APIs follow the pattern: `/api/v1/{resource}`

| Method | Endpoint                     | Description                       |
|--------|------------------------------|-----------------------------------|
| GET    | `/api/v1/meta/doctypes`      | List all registered DocTypes      |
| GET    | `/api/v1/meta/doctype/:name` | Get full metadata of a DocType    |
| GET    | `/api/v1/meta/modules`       | List all registered modules       |
| GET    | `/api/v1/system/health`      | System health check               |

---

## UI Behaviour

The Framee frontend renders entirely from metadata:

1. **Navigation** — Menu items are fetched from `sys_menu` and rendered dynamically per user role.
2. **Forms** — DocType metadata drives field rendering, validations, and layout.
3. **Lists** — Column definitions, filters, and sort options are derived from DocField metadata.
4. **Layouts** — Page containers and section groupings are defined in metadata, not hard-coded.

The UI is **Mobile First** — all views are designed for 375px viewport and scale up.

---

## Configuration

| Config Key             | Default           | Description                             |
|------------------------|-------------------|-----------------------------------------|
| `METADATA_CACHE_TTL`   | `3600`            | Metadata cache TTL in seconds           |
| `TENANT_HEADER`        | `X-Tenant-ID`     | HTTP header for tenant identification   |
| `DEFAULT_PAGE_SIZE`    | `20`              | Default list pagination size            |
| `MAX_PAGE_SIZE`        | `200`             | Maximum records per API request         |
| `PLUGIN_DIR`           | `./plugins`       | Directory scanned for plugin manifests  |
| `AUDIT_LOG_ENABLED`    | `true`            | Enable/disable audit trail logging      |
| `AI_SCHEMA_EXPORT`     | `true`            | Enable AI-friendly metadata endpoint    |

---

## Validation Rules

- Every DocType must have a unique `name`.
- Fieldnames must be lowercase alphanumeric with underscores only.
- Required fields must be enforced at the API layer, not only the UI.
- ~~Tenant ID must never be overrideable by client input.~~ **[DEPRECATED — no multi-tenancy]**
- Workflow transitions must only be triggered by users with the appropriate Role.

---

## Security

### Authentication
- JWT-based authentication with short-lived access tokens and refresh token rotation.
- Session context carries `user_id` and `roles[]`.

### Authorization
- Role-based access control enforced at the API engine layer.
- Field-level permission checks before serializing API responses.
- No record is returned if the user's role does not have `read` permission on the DocType.

### ~~Multi-Tenant Isolation~~ [DEPRECATED]
- ~~All queries automatically prepend `WHERE tenant_id = :tenant_id`.~~
- ~~Tenant ID is resolved from JWT, never from client payload.~~

### Input Validation
- All inputs are validated against DocField metadata rules (type, required, max_length).
- SQL injection prevention via parameterized queries only.
- XSS prevention via output encoding at the API serializer level.

---

## Events

### Emitted Events

| Event               | Trigger                           |
|---------------------|-----------------------------------|
| `system.boot`       | Framework startup completed       |
| `plugin.registered` | A plugin has been loaded          |
| `doctype.created`   | A new DocType is registered       |
| `metadata.reloaded` | Metadata cache has been refreshed |
| `user.login`        | User authenticated successfully   |
| `user.logout`       | User session terminated           |

### Listened Events

| Event               | Action                                 |
|---------------------|----------------------------------------|
| `plugin.registered` | Reload module and menu metadata        |
| `metadata.reloaded` | Clear and rebuild Redis metadata cache |

---

## Performance

### Caching Strategy
- All DocType and DocField metadata is cached in Redis with TTL-based invalidation.
- Metadata cache is invalidated on any `sys_doctype` or `sys_docfield` write.
- User permission sets are cached per user per tenant for the duration of the session.

### Optimization
- Paginated list APIs with cursor-based pagination support for large datasets.
- Selective field loading via `?fields=` query parameter to minimize payload size.
- Database connection pooling via the Database Engine.

### Indexes
- Composite indexes on `(tenant_id, is_deleted)` across all core tables.
- Full-text indexes on searchable string fields (configurable per DocField).

---

## Future Improvements

- **GraphQL API Layer** — Expose metadata-driven GraphQL schema alongside REST.
- **Real-Time Sync** — WebSocket support for live record updates.
- **AI Co-Pilot** — AI assistant that reads metadata and suggests field configurations.
- **Visual Workflow Designer** — Drag-and-drop workflow state machine builder.
- **Plugin Marketplace** — Centralized registry for distributing and installing plugins.
- **Offline Support** — Progressive Web App with service worker for field-use scenarios.
- **Automated API Documentation** — Auto-generated OpenAPI spec from DocType metadata.

---

## Acceptance Criteria

- [ ] Framework can boot with zero plugins and expose the `/api/v1/system/health` endpoint.
- [ ] At least one DocType can be registered via the admin UI and its CRUD API is auto-generated.
- [ ] A plugin can be dropped into the plugin directory and its DocTypes appear without code changes.
- [ ] All APIs reject requests with no valid JWT.
- [ ] All queries are automatically scoped to the active tenant.
- [ ] Metadata changes are reflected in the API within one cache TTL cycle.
- [ ] The Dynamic Form renders correctly for a DocType with 10+ fields of mixed types.
- [ ] The Dynamic List renders, paginates, and filters a DocType with 1000+ records without degradation.
- [ ] All CRUD operations emit the correct lifecycle events.
- [ ] Audit log captures all write operations with user and diff information.

---

## Notes

- Framee is intentionally domain-agnostic. No business logic for Finance, HR, or other domains belongs in the core framework.
- All "system" tables use the `sys_` prefix. Plugin-generated tables use a module-specific prefix defined in the plugin manifest.
- The framework's metadata layer is the single source of truth. UI, API, and validation are all derived from it — never duplicated.
- AI-friendliness means metadata schemas include `description`, `hint`, and `example` fields that LLMs can use to understand intent.
