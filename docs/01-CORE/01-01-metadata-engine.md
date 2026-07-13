# 01-01 Metadata Engine

## Purpose

The Metadata Engine is the **central nervous system** of Framee. It is the component responsible for loading, caching, serving, and invalidating all DocType and DocField definitions that drive the entire system's behavior.

Every dynamic behavior in Framee — form rendering, API generation, CRUD validation, permission checking, and workflow execution — reads from the Metadata Engine. Without it, the system cannot function.

The engine exists because Framee's core promise is that business structure is **declared, not coded**. The Metadata Engine is the layer that makes that declaration accessible to all other engines in real time.

---

## Goals

1. Provide a fast, consistent, and reliable read interface for all DocType and DocField metadata across the system.
2. Cache metadata in Redis to eliminate redundant database reads for every API request.
3. Invalidate and refresh the cache automatically when metadata changes are made.
4. Expose metadata in an AI-friendly, machine-readable format.
5. Support multi-tenant metadata isolation — each tenant's metadata is independent.
6. Allow plugins to register additional DocTypes into the metadata registry without modifying core code.

---

## Scope

### In Scope
- Loading DocType definitions from the database on startup and on-demand
- Loading DocField definitions associated with each DocType
- Caching metadata in Redis with configurable TTL
- Cache invalidation when DocType or DocField records change
- Exposing a metadata read API for internal engines and external API consumers
- Plugin-contributed DocType registration
- AI-friendly metadata export (with `description`, `hint`, `example` fields)

### Out of Scope
- Creating or modifying DocType and DocField records (responsibility of the CRUD Engine via the System module)
- Executing CRUD operations on DocType-defined records (responsibility of the CRUD Engine)
- Rendering forms or lists (responsibility of the Frontend)
- Permission enforcement (responsibility of the Permission Engine, which reads from Metadata Engine)

---

## Functional Requirements

### FR-001 Load on Boot
- On system startup, the Metadata Engine must pre-load all active DocTypes and their fields from the database into Redis cache.
- Startup must not complete until the metadata cache is warmed.

### FR-002 Single Read Interface
- All engines (CRUD, API, Permission, Workflow) must request metadata exclusively through the Metadata Engine. Direct database queries for DocType data from other engines are forbidden.

### FR-003 Redis Cache
- Metadata is stored in Redis under namespaced keys: `{CACHE_PREFIX}:meta:{tenant_id}:{doctype_name}`.
- Cache TTL is configurable per environment (default: 3600 seconds).
- On a cache miss, the engine fetches from the database and repopulates the cache.

### FR-004 Cache Invalidation
- When a `sys_doctype` or `sys_docfield` record is created, updated, or deleted, the Metadata Engine must invalidate the affected cache entry.
- Invalidation is triggered via an event subscription on `doctype.saved` and `docfield.saved` events.

### FR-005 Plugin DocType Registration
- Plugins can register DocTypes via the plugin registry at startup.
- Plugin-registered DocTypes are merged into the metadata registry and treated identically to database-registered DocTypes.

### FR-006 AI Export
- The engine must expose a `/api/v1/meta/ai-schema` endpoint that returns all DocTypes with their fields, types, descriptions, hints, and examples in a structured JSON format consumable by AI agents.

### FR-007 Multi-Tenant Isolation
- All metadata reads are scoped by `tenant_id`.
- A tenant cannot access or modify another tenant's DocType definitions.

### FR-008 Hot Reload
- The Metadata Engine must support hot reload of a specific DocType without restarting the server.
- Hot reload is triggered via an internal API call: `POST /api/v1/meta/reload/:doctype_name`.

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Metadata Engine                        │
│                                                          │
│  ┌──────────────┐   ┌──────────────┐   ┌─────────────┐  │
│  │  Cache Layer │   │  Loader      │   │  Registry   │  │
│  │  (Redis)     │◄──│  (DB Reader) │   │  (Plugin    │  │
│  │              │   │              │   │   DocTypes) │  │
│  └──────┬───────┘   └──────┬───────┘   └──────┬──────┘  │
│         │                  │                  │          │
│         └──────────────────▼──────────────────┘          │
│                      In-Memory Store                      │
│                   (fallback / warmup)                     │
└──────────────────────────────┬───────────────────────────┘
                               │ getDocType(name, tenantId)
              ┌────────────────┼────────────────────┐
              ▼                ▼                    ▼
         CRUD Engine    Permission Engine    API Engine
```

### Key Components

| Component | Responsibility |
|-----------|---------------|
| **Cache Layer** | Read/write Redis. Namespace by tenant and DocType name. |
| **Loader** | Query `sys_doctype` and `sys_docfield` from MySQL. |
| **Registry** | Hold plugin-registered DocTypes in memory. Merged at read time. |
| **Event Subscriber** | Listen for `doctype.saved` and `docfield.saved` to trigger invalidation. |

### Read Flow

```
Request getDocType(name, tenantId)
  → Check Redis cache
    → HIT: return cached metadata
    → MISS: query MySQL
           → store in Redis
           → return metadata
```

---

## Database Design

### Tables Read

#### `sys_doctype`
| Column | Type | Description |
|--------|------|-------------|
| `id` | VARCHAR(36) | UUID PK |
| `tenant_id` | VARCHAR(36) | Tenant reference |
| `name` | VARCHAR(100) | Unique DocType name per tenant |
| `module_id` | VARCHAR(36) | FK → sys_module.id |
| `label` | VARCHAR(150) | Display name |
| `description` | TEXT | Human and AI readable description |
| `is_submittable` | TINYINT(1) | Supports Submit/Cancel workflow |
| `is_tree` | TINYINT(1) | Hierarchical tree structure |
| `track_changes` | TINYINT(1) | Enable audit trail |
| `title_field` | VARCHAR(100) | Field used as record title |
| `search_fields` | TEXT | Comma-separated searchable fields |
| `is_active` | TINYINT(1) | Soft enable/disable |
| `created_at` | DATETIME | Auto timestamp |
| `updated_at` | DATETIME | Auto timestamp |
| `is_deleted` | TINYINT(1) | Soft delete flag |

#### `sys_docfield`
| Column | Type | Description |
|--------|------|-------------|
| `id` | VARCHAR(36) | UUID PK |
| `tenant_id` | VARCHAR(36) | Tenant reference |
| `doctype_id` | VARCHAR(36) | FK → sys_doctype.id |
| `fieldname` | VARCHAR(100) | Programmatic field name (snake_case) |
| `label` | VARCHAR(150) | Display label |
| `fieldtype` | VARCHAR(50) | Data type (Data, Int, Date, Link, Select, etc.) |
| `options` | TEXT | Options for Select; DocType name for Link |
| `default_value` | VARCHAR(255) | Default field value |
| `is_required` | TINYINT(1) | Mandatory field flag |
| `is_read_only` | TINYINT(1) | Non-editable field |
| `is_hidden` | TINYINT(1) | Hidden from UI |
| `in_list_view` | TINYINT(1) | Show in list columns |
| `in_standard_filter` | TINYINT(1) | Show in list filter bar |
| `description` | TEXT | AI-friendly field description |
| `hint` | VARCHAR(255) | Placeholder/example hint |
| `sort_order` | INT | Display order |
| `section` | VARCHAR(100) | Section grouping name |
| `column_width` | TINYINT | Grid column span (1–12) |

### Indexes

```sql
-- sys_doctype
INDEX idx_doctype_tenant_name (tenant_id, name)
INDEX idx_doctype_tenant_deleted (tenant_id, is_deleted)
INDEX idx_doctype_module (module_id)

-- sys_docfield
INDEX idx_docfield_doctype (doctype_id)
UNIQUE INDEX idx_docfield_unique (tenant_id, doctype_id, fieldname)
INDEX idx_docfield_sort (doctype_id, sort_order)
```

---

## API Design

### Internal API (Engine-to-Engine)

| Method | Signature | Description |
|--------|-----------|-------------|
| `getDocType(name, tenantId)` | Returns full DocType with fields | Primary metadata read |
| `getDocField(doctype, fieldname, tenantId)` | Returns single field definition | Field-level metadata read |
| `getAllDocTypes(tenantId)` | Returns all DocTypes for tenant | Used by API Engine for route generation |
| `invalidate(doctype, tenantId)` | Clears cache for a DocType | Called on save/delete events |
| `reloadAll(tenantId)` | Full cache rebuild for a tenant | Admin hot reload |

### REST API (External)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/meta/doctypes` | List all DocTypes for current tenant |
| `GET` | `/api/v1/meta/doctype/:name` | Full metadata for one DocType (with fields) |
| `GET` | `/api/v1/meta/doctype/:name/fields` | Fields only for a DocType |
| `POST` | `/api/v1/meta/reload/:name` | Hot reload specific DocType cache |
| `POST` | `/api/v1/meta/reload-all` | Full metadata cache reload |
| `GET` | `/api/v1/meta/ai-schema` | AI-friendly full schema export |

#### Example Response — `GET /api/v1/meta/doctype/Customer`

```json
{
  "success": true,
  "data": {
    "name": "Customer",
    "label": "Customer",
    "description": "Represents a business customer entity in the CRM module.",
    "is_submittable": false,
    "track_changes": true,
    "title_field": "customer_name",
    "fields": [
      {
        "fieldname": "customer_name",
        "label": "Customer Name",
        "fieldtype": "Data",
        "is_required": true,
        "description": "Full legal name of the customer.",
        "hint": "e.g. PT. Maju Jaya Indonesia"
      },
      {
        "fieldname": "customer_type",
        "label": "Customer Type",
        "fieldtype": "Select",
        "options": "Company\nIndividual\nGovernment",
        "is_required": true,
        "description": "Classification of the customer entity type."
      }
    ]
  },
  "meta": {
    "cached": true,
    "cached_at": "2026-07-13T00:00:00Z"
  }
}
```

---

## UI Behaviour

The Metadata Engine itself has no direct UI. Its data is consumed by:

- **Dynamic Form** — reads field definitions to render form inputs
- **Dynamic List** — reads `in_list_view` fields to build list columns
- **Dynamic Layout** — reads `section` and `column_width` for layout grouping

Admin users interact with metadata via the `DocType` and `DocField` system modules (see `02-02` and `02-03`).

---

## Configuration

| Config Key | Default | Description |
|------------|---------|-------------|
| `METADATA_CACHE_TTL` | `3600` | Redis cache TTL in seconds |
| `METADATA_WARM_ON_BOOT` | `true` | Pre-load all metadata on startup |
| `METADATA_AI_EXPORT_ENABLED` | `true` | Enable `/api/v1/meta/ai-schema` endpoint |
| `METADATA_HOT_RELOAD_ENABLED` | `true` | Enable hot reload API endpoints |
| `METADATA_CACHE_PREFIX` | `framee:meta` | Redis key prefix |

---

## Validation Rules

- `name` must be unique per tenant. Duplicate DocType names within a tenant are rejected.
- `fieldname` must be unique per DocType. Duplicates within the same DocType are rejected.
- `fieldname` must match the pattern `^[a-z][a-z0-9_]*$` — lowercase, underscore-separated, starts with a letter.
- `fieldtype` must be one of the registered field types (Data, Int, Float, Currency, Date, Datetime, Time, Text, Long Text, Select, Link, Table, Check, Attach, HTML).
- A Link field must have `options` set to a valid, existing DocType name.
- A Select field must have `options` containing at least one value.
- `description` is mandatory for all DocFields (enforced at the metadata creation layer).

---

## Security

- All metadata read endpoints require a valid JWT.
- Metadata is scoped to `tenant_id` — cross-tenant metadata access returns 403 Forbidden.
- The `/api/v1/meta/reload-all` endpoint requires the `System Manager` role.
- The `/api/v1/meta/ai-schema` endpoint can be restricted via configuration for tenants that do not consent to AI schema exposure.
- DocType names are sanitized before being used as Redis cache keys to prevent key injection.

---

## Events

### Emitted Events

| Event | Payload | Trigger |
|-------|---------|---------|
| `metadata.loaded` | `{ tenant_id, doctype_count }` | Boot cache warm complete |
| `metadata.cache_hit` | `{ tenant_id, doctype }` | Cache served metadata |
| `metadata.cache_miss` | `{ tenant_id, doctype }` | DB fallback triggered |
| `metadata.invalidated` | `{ tenant_id, doctype }` | Cache entry cleared |
| `metadata.reloaded` | `{ tenant_id, doctype }` | Hot reload completed |

### Listened Events

| Event | Action |
|-------|--------|
| `doctype.after_save` | Invalidate DocType cache entry |
| `docfield.after_save` | Invalidate parent DocType cache entry |
| `doctype.after_delete` | Remove DocType cache entry entirely |
| `plugin.registered` | Register plugin DocTypes into memory registry |

---

## Performance

### Caching Strategy
- **Warm on Boot**: All active DocTypes are loaded into Redis at startup. No cold start performance impact on first request.
- **Lazy Repopulation**: On cache miss (e.g., after TTL expiry), the engine fetches from MySQL and repopulates. This is a background concern, not a user-facing delay.
- **Tenant-Scoped Keys**: Cache keys include `tenant_id`, preventing cross-tenant pollution.

### Optimization
- Redis pipeline operations are used when loading multiple DocTypes in batch (startup warm).
- DB query fetches DocType and all its fields in a single JOIN query to avoid N+1 reads.
- In-memory LRU cache (small, max 100 entries) sits in front of Redis for the 10 most recently accessed DocTypes per process.

### Indexes
- `sys_doctype(tenant_id, name)` — primary lookup path, unique index ensures fast single-record fetch.
- `sys_docfield(doctype_id, sort_order)` — ordered field list fetch per DocType.

---

## Future Improvements

- **Metadata Versioning** — Track history of DocType schema changes for rollback and audit.
- **Schema Diffing** — Detect and report differences between current and previous metadata versions.
- **AI Schema Annotations** — Enriched metadata with LLM-optimized descriptions auto-suggested by AI.
- **Distributed Invalidation** — Redis Pub/Sub-based cache invalidation across multiple backend instances.
- **Metadata Inheritance** — Allow a DocType to inherit fields from a base DocType.
- **Draft Metadata** — Support unpublished DocType drafts that can be previewed before activation.

---

## Acceptance Criteria

- [ ] On boot, all active DocTypes for all tenants are loaded into Redis within 5 seconds for up to 1000 DocTypes.
- [ ] `getDocType('Customer', tenantId)` returns the full DocType with all fields in under 5ms (from cache).
- [ ] `getDocType('Customer', tenantId)` returns the correct data from MySQL when cache is cold, and populates cache.
- [ ] After saving a DocField, the parent DocType cache is invalidated and the next read fetches fresh data from MySQL.
- [ ] A tenant cannot retrieve metadata belonging to another tenant.
- [ ] `GET /api/v1/meta/doctype/Customer` returns all fields with `description`, `hint`, and `fieldtype`.
- [ ] `GET /api/v1/meta/ai-schema` returns a valid JSON structure usable by an LLM without further transformation.
- [ ] `POST /api/v1/meta/reload/Customer` hot-reloads the cache for Customer without server restart.
- [ ] Plugin-registered DocTypes appear in `getAllDocTypes()` and are indistinguishable from DB-registered ones.
- [ ] A request with an invalid JWT returns 401. A request for another tenant's metadata returns 403.

---

## Notes

- The Metadata Engine is **read-heavy, write-rare**. The caching strategy is optimized for this access pattern.
- Do not add business logic to the Metadata Engine. It is a pure metadata provider. All validation of metadata content (e.g., "is this DocType name valid for ERP?") belongs in the system service layer.
- The `ai-schema` endpoint is a first-class feature, not an afterthought. It is the primary interface through which AI agents understand the data model of the ERP system.
- Metadata changes in a multi-instance deployment (multiple Node.js processes) must use Redis Pub/Sub for cross-process cache invalidation. This is not required in single-instance deployments.
