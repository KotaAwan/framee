# 00-02 Golden Rules

## Purpose

The Golden Rules define the **non-negotiable architectural and engineering principles** that every contributor, plugin author, and module developer must follow when building on top of Framee. These rules exist to protect the long-term integrity, scalability, and maintainability of the system as it grows across teams, tenants, and domains.

Breaking a Golden Rule is not a shortcut — it is technical debt that compounds at an ERP scale.

---

## Goals

1. Establish a shared engineering contract that all developers — core team and plugin authors — agree to follow.
2. Prevent architectural drift as the codebase grows across multiple modules and plugins.
3. Enable AI agents and automated tooling to reason about the codebase reliably.
4. Ensure that any module or plugin built on Framee is predictable, secure, and interoperable.

---

## Scope

### In Scope
- Rules governing core framework development
- Rules governing plugin and module development
- Rules governing frontend component development
- Rules governing API design
- Rules governing database schema design

### Out of Scope
- Code style preferences (those belong in a separate linting/style guide)
- Infrastructure and DevOps rules (those belong in the deployment constitution)

---

## Functional Requirements

### FR-001 Rule Enforcement
- Golden Rules must be documented, versioned, and available to all developers as part of the framework repository.
- Automated linting or architectural tests should flag violations where technically possible.

### FR-002 Plugin Compliance
- All plugins submitted to the plugin registry must pass a Golden Rule compliance checklist before approval.

### FR-003 Rule Versioning
- Changes to Golden Rules must be versioned and communicated to all plugin authors with a migration guide.

---

## Architecture

Golden Rules are organized into six domains:

```
Golden Rules
├── 1. Core Integrity Rules
├── 2. Metadata Rules
├── 3. Plugin Rules
├── 4. API Rules
├── 5. Database Rules
└── 6. Frontend Rules
```

Each rule is uniquely identified (e.g., `GR-CORE-01`) and carries a severity level:

| Severity | Meaning                                                            |
|----------|--------------------------------------------------------------------|
| `MUST`   | Non-negotiable. Violating this rule breaks the system contract.    |
| `SHOULD` | Strongly recommended. Deviation requires documented justification. |
| `MAY`    | Optional best practice. Encouraged but not enforced.               |

---

## Database Design

_Not applicable for this document. Golden Rules are a governance artifact, not a data entity._

---

## API Design

_Not applicable for this document._

---

## UI Behaviour

_Not applicable for this document._

---

## Configuration

Golden Rules are not configurable by design. They are absolute constraints. The only exception is where a rule references a configurable parameter (e.g., cache TTL), in which case the rule defines the bounds within which configuration is permitted.

---

## Validation Rules

### 1. Core Integrity Rules

| ID         | Severity | Rule                                                                                                                  |
|------------|----------|-----------------------------------------------------------------------------------------------------------------------|
| GR-CORE-01 | MUST     | Core framework code must NEVER import from any plugin directory. Plugins register themselves into the core via hooks. |
| GR-CORE-02 | MUST     | All cross-module communication must go through the Event Engine. Direct function calls between modules are forbidden. |
| GR-CORE-03 | MUST     | No business domain logic (Finance, HR, Procurement, etc.) belongs in the core framework layer.                        |
| GR-CORE-04 | MUST     | All operations that modify data must emit the appropriate lifecycle event. Suppressing events is forbidden.           |
| GR-CORE-05 | SHOULD   | Framework core must remain functional with zero plugins loaded.                                                       |

### 2. Metadata Rules

| ID         | Severity | Rule |
|------------|----------|------|
| GR-META-01 | MUST     | DocType definitions are the single source of truth. UI fields, API validation, and database columns must all derive from metadata — never be duplicated. |
| GR-META-02 | MUST     | Metadata must be treated as data, not code. No metadata is hard-coded in source files. |
| GR-META-03 | MUST     | Every DocField must have a `label`, `fieldtype`, and `description`. The `description` field is mandatory for AI-friendliness. |
| GR-META-04 | MUST     | Metadata changes must invalidate the relevant cache entries immediately. Stale metadata is not acceptable. |
| GR-META-05 | SHOULD   | DocType metadata should include `hint` and `example` values on fields where the intended value format is non-obvious. |

### 3. Plugin Rules

| ID        | Severity | Rule |
|-----------|----------|------|
| GR-PLG-01 | MUST     | Every plugin must declare a `plugin.manifest.json` describing its name, version, author, dependencies, and provided DocTypes. |
| GR-PLG-02 | MUST     | Plugins must not modify core system tables directly. All extensions are via registered hooks or new plugin-owned tables. |
| GR-PLG-03 | MUST     | Plugin tables must use a namespace prefix (e.g., `inv_`, `hr_`) to prevent naming collisions. |
| GR-PLG-04 | MUST     | Plugins must register cleanly and unregister cleanly. Removing a plugin must not leave orphaned records in core tables. |
| GR-PLG-05 | SHOULD   | Plugins should expose their own API documentation via the `/api/v1/meta/plugin/:name/schema` endpoint. |

### 4. API Rules

| ID | Severity | Rule |
|----|----------|------|
| GR-API-01 | MUST | All API responses must follow the standard Framee response envelope: `{ success, data, meta, error }`. |
| GR-API-02 | MUST | All APIs must require a valid JWT. Unauthenticated endpoints must be explicitly whitelisted in configuration. |
| GR-API-03 | MUST | Tenant ID must always be resolved from JWT context, never from the request payload or query string. |
| GR-API-04 | MUST | All list endpoints must support pagination. Returning unbounded result sets is forbidden. |
| GR-API-05 | MUST | API versioning is mandatory. Breaking changes require a new version namespace (e.g., `/api/v2/`). |
| GR-API-06 | SHOULD | All endpoints must return appropriate HTTP status codes. Using `200 OK` for errors is forbidden. |
| GR-API-07 | SHOULD | APIs should support sparse fieldsets via the `?fields=` query parameter to reduce payload size. |

### 5. Database Rules

| ID | Severity | Rule |
|----|----------|------|
| GR-DB-01 | MUST | Every table must have a `tenant_id` column. No shared tables across tenants are permitted. |
| GR-DB-02 | MUST | Primary keys must be UUID v4 (VARCHAR 36). Auto-increment integers are forbidden for distributed compatibility. |
| GR-DB-03 | MUST | All DELETE operations must use soft delete (`is_deleted = 1`). Hard deletes are forbidden except in explicit data purge workflows. |
| GR-DB-04 | MUST | All queries must use parameterized statements. String interpolation in SQL is forbidden. |
| GR-DB-05 | MUST | Every table must carry `created_at`, `updated_at`, `created_by`, and `updated_by` audit columns. |
| GR-DB-06 | MUST | Composite index on `(tenant_id, is_deleted)` is mandatory on every table. |
| GR-DB-07 | SHOULD | Foreign key relationships should be enforced at the application layer, not the database layer, to support horizontal scaling. |

### 6. Frontend Rules

| ID | Severity | Rule |
|----|----------|------|
| GR-FE-01 | MUST | No form fields, columns, or layout definitions are hard-coded in frontend components. All UI is driven by metadata fetched from the API. |
| GR-FE-02 | MUST | All interactive elements must have unique, descriptive `id` attributes for automated testing and accessibility. |
| GR-FE-03 | MUST | Mobile-first CSS is mandatory. Desktop styles are additive overrides via responsive breakpoints. |
| GR-FE-04 | MUST | Components must not embed business logic. Business logic belongs in the API layer. |
| GR-FE-05 | SHOULD | All user-visible text must be routed through the i18n translation layer, even for initial English-only releases. |
| GR-FE-06 | SHOULD | Frontend state for metadata should be cached in-memory and invalidated based on API cache headers. |

---

## Security

- Golden Rules themselves are a security control — particularly GR-API-02, GR-API-03, GR-DB-01, and GR-DB-04.
- Rule compliance checks are part of the security audit checklist.
- Plugin review process must verify that no Golden Rule security rules are violated before a plugin is approved.

---

## Events

| Event | Trigger |
|-------|---------|
| `golden_rule.violation.detected` | Emitted when automated architectural tests detect a rule violation (if tooling is configured) |

---

## Performance

Golden Rules include performance-impacting constraints:

- **GR-DB-06** (mandatory indexes) directly ensures query performance at scale.
- **GR-API-04** (mandatory pagination) prevents unbounded queries that cause OOM at scale.
- **GR-META-04** (cache invalidation) ensures the system never serves stale metadata from cache.

---

## Future Improvements

- **Automated Rule Validator** — A CLI tool that scans plugin code and flags Golden Rule violations before deployment.
- **Rule Compliance Badge** — Plugins in the marketplace display a compliance badge based on automated checks.
- **AI Rule Auditor** — An AI agent that reads new plugin code and checks it against the Golden Rules before human review.
- **Rule Versioning Portal** — A changelog-style portal that tracks rule additions and changes with migration guides.

---

## Acceptance Criteria

- [ ] All 6 rule categories are documented with unique rule IDs and severity levels.
- [ ] Golden Rules document is available in the framework repository root as a first-class document.
- [ ] A plugin that violates GR-PLG-02 (direct core table modification) is detectable via automated schema diffing.
- [ ] All core framework API endpoints comply with GR-API-01 (standard response envelope).
- [ ] All core database tables comply with GR-DB-01 through GR-DB-06.
- [ ] Frontend components comply with GR-FE-01 (no hard-coded field definitions).
- [ ] Developer onboarding documentation references Golden Rules as mandatory reading.

---

## Notes

- Golden Rules are a **living document**. As the framework evolves, rules may be added but should rarely be removed.
- When a rule must change due to genuine architectural evolution, the change must be versioned, announced to plugin authors, and accompanied by a migration guide.
- The spirit of the Golden Rules is **predictability and trust** — any developer who reads them should be able to make correct architectural decisions without needing to ask.
- AI agents reading the codebase should find the Golden Rules sufficient to understand the framework's constraints and generate compliant code.
