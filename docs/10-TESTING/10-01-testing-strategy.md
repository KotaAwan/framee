# 10-01 Testing Strategy

## Purpose

Documents the overall testing strategy for Framee — what to test, how to test it, the tooling used, and the standards required for a feature to be considered production-ready.

---

## 1. Testing Philosophy

> "Test the behavior, not the implementation."

Framee tests verify that the system behaves correctly from the perspective of its callers (API consumers, event subscribers, UI users). We do not write tests that check internal implementation details that are likely to change.

---

## 2. Test Pyramid

```
        /\
       /  \
      / E2E \       (Small number — key user journeys)
     /--------\
    /Integration\   (Medium — all API endpoints)
   /--------------\
  /   Unit Tests   \ (Large — all Core Engines + Utils)
 /------------------\
```

- **Unit Tests**: Fast, isolated, no I/O. Cover all Core Engine methods and utility functions.
- **Integration Tests**: Test the full HTTP stack (Express → Engine → DB). Use a dedicated test database.
- **E2E Tests**: Browser-level tests (Playwright) for critical user journeys. Run on staging environment.

---

## 3. Tooling

| Layer | Tool | Why |
|-------|------|-----|
| Unit + Integration | **Vitest** | Fast, native ESM support, compatible with Vite ecosystem |
| HTTP Integration | **Supertest** | Test Express routes without starting a real server |
| E2E | **Playwright** | Cross-browser, reliable, excellent CI integration |
| Coverage | **Vitest Coverage (v8)** | Native V8 coverage without instrumentation overhead |
| Mock / Spy | **Vitest (`vi.fn()`)** | Built-in, no need for jest-mock |

---

## 4. Test Database Setup

Integration tests require a real MySQL database. The recommended setup:

1. Create a `framee_test` database (separate from `framee_dev`).
2. Set `APP_ENV=test` and `DB_NAME=framee_test` in test environment.
3. Before the test suite: run all migrations against `framee_test`.
4. Before each test file: seed minimum required data (e.g., a test tenant, a test user).
5. After each test: truncate touched tables (not drop — dropping is too slow).

```javascript
// tests/helpers/db.js
export async function cleanupTables(db, tables) {
  for (const table of tables) {
    await db(table).where({ tenant_id: TEST_TENANT_ID }).delete();
  }
}
```

---

## 5. Coverage Targets

| Layer | Minimum Coverage |
|-------|-----------------|
| `src/core/` (Core Engines) | 80% line coverage |
| `src/modules/` (Services) | 70% line coverage |
| API endpoints (Integration) | 100% happy path + top 3 error cases per endpoint |
| `src/utils/` (Helpers) | 90% line coverage |
| Frontend `hooks/` | 60% line coverage |

Coverage is enforced in CI — a PR that drops coverage below thresholds is blocked.

---

## 6. Test File Organization

```
apps/backend/
├── src/
│   └── core/
│       └── MetadataEngine/
│           ├── MetadataEngine.js
│           └── MetadataEngine.test.js   ← Unit test alongside source
└── tests/
    └── integration/
        ├── auth.test.js
        ├── crud.test.js
        └── workflow.test.js

apps/frontend/
└── src/
    └── hooks/
        ├── useDocMeta.js
        └── useDocMeta.test.js
```

---

## 7. CI/CD Integration

All tests run automatically via GitHub Actions on:
- Every push to a `feature/*` or `fix/*` branch.
- Every PR targeting `develop` or `main`.

The pipeline:
```yaml
- Run: npm run lint
- Run: npm run test:unit
- Run: npm run test:integration   # Starts test DB in Docker
- Run: npm run test:coverage      # Fails if below thresholds
```

E2E tests (`npm run test:e2e`) run only on merges to `develop`, using the staging environment.

---

## 8. What NOT to Test

- Database migration files themselves (they are verified by running `npm run migrate` successfully).
- Third-party library internals (axios, knex, redis).
- Generated metadata/SQL — test the behavior, not the SQL string.
- Console output formatting.
