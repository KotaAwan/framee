# 99-02 Definition of Done (DoD)

## Purpose

The Definition of Done is the quality checklist that every completed work item must satisfy before it can be considered "Done" and merged into the `develop` branch. No exceptions.

---

## Level 1: Code Quality (Every Commit)

- [ ] Code uses ES Modules (`import/export`), not CommonJS (`require`).
- [ ] No `console.log` — all logging uses `logger.*` (Winston).
- [ ] No hardcoded configuration values — all from `process.env.*`.
- [ ] Every public method has a JSDoc comment.
- [ ] No business logic in Controller files.
- [ ] No raw SQL strings — all queries use Knex builder.
- [ ] All `dt_*` and `sys_*` queries include `tenant_id`.
- [ ] All errors are thrown as `FrameeError` subclasses (not plain `Error`).
- [ ] Commit message follows the `type(scope): description` format.

---

## Level 2: Feature Completeness (Every Feature Branch)

- [ ] Feature matches the PRD specification (cross-checked against `01-CORE/` or `02-SYSTEM/`).
- [ ] All happy path scenarios work end-to-end.
- [ ] All major error cases return correct HTTP status codes and standard error format.
- [ ] If the feature writes to the DB, a migration file exists and is tested.
- [ ] If the feature adds a DocType, the metadata JSON file exists in `/metadata/`.
- [ ] If the feature fires events, the event names follow the convention `{DocType}.{event_name}`.
- [ ] API endpoint (if applicable) is documented in `07-API/`.

---

## Level 3: Testing (Before PR)

- [ ] Unit tests written for all new public methods in Core Engines.
- [ ] Integration tests written for all new API endpoints (happy path + primary error cases).
- [ ] All existing tests pass (no regression).
- [ ] Coverage meets minimum thresholds:
  - Core Engines (`src/core/`): ≥ 80%
  - Service Layer (`src/modules/`): ≥ 70%
- [ ] Tests are isolated (no dependency on other tests or external state).
- [ ] Test database is cleaned up after each test suite runs.

---

## Level 4: Security (Every PR)

- [ ] No sensitive data logged (passwords, tokens, credit card numbers, PII).
- [ ] No new endpoint is publicly accessible without JWT authentication.
- [ ] No endpoint accepts `tenant_id` from the request body (always from JWT).
- [ ] All `Link` field values are validated against the target DocType for the same `tenant_id`.
- [ ] New admin endpoints validate `System Manager` role in the Controller.

---

## Level 5: Documentation (Before Merge to `main`)

- [ ] Technical decisions are documented in the relevant `docs/` file.
- [ ] If a new DB table was created, the schema is documented in `05-DATABASE/`.
- [ ] If a new API endpoint was created, it is documented in `07-API/`.
- [ ] `99-01-milestone.md` is updated to reflect completion of the milestone.
- [ ] CHANGELOG is updated (or commit history is clean enough to generate one).

---

## Level 6: Engine-Specific Checklists

### For a new Core Engine
- [ ] Engine is a Singleton instantiated at startup.
- [ ] Engine registers to DI Container under a clear name.
- [ ] Engine has no direct import of Plugin code.
- [ ] Engine has its own subfolder in `src/core/`.

### For a new DocType (via Plugin or Admin)
- [ ] `sys_doctype` and `sys_docfield` records are created.
- [ ] `dt_*` table is created by DB Engine.
- [ ] `dt_*_logs` table is created.
- [ ] `dt_*_likes` table is created.
- [ ] Permissions for at least one role are configured in `sys_permission`.
- [ ] DocType appears in `GET /api/v1/meta/doctypes` response.

### For a new Plugin
- [ ] Plugin has a valid `plugin.json` manifest.
- [ ] Plugin `init()` method only registers hooks and routes — it does not execute business logic.
- [ ] Plugin uses the DI Container to access Core Engines — no direct imports.
- [ ] Plugin can be disabled without crashing the core system.
