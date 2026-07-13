# 06-09 Testing Rules

## Purpose

Standards and guidelines for writing tests in Framee. Good tests provide confidence that every engine works according to specification and that code changes do not break existing features (Regression Protection).

---

## 1. Types of Tests

Framee uses 3 types of tests:

| Type | Tools | Focus | Speed |
|------|-------|-------|-------|
| Unit Test | Vitest / Jest | One isolated class/function | Very Fast |
| Integration Test | Vitest + Supertest | API endpoints + DB (test database) | Medium |
| E2E Test | Playwright | User flows in the browser | Slow |

MVP Priority: **Unit Tests** and **Integration Tests**. E2E can be added later.

---

## 2. Unit Test Rules

### Target
- All public methods in every Core Engine.
- All utility functions in `utils/`.
- All custom React hooks (`hooks/`).

### Principle: AAA (Arrange, Act, Assert)

```javascript
// MetadataEngine.test.js
describe('MetadataEngine', () => {
  describe('getDocMeta()', () => {
    it('should return metadata from in-memory cache if available', async () => {
      // Arrange
      const mockMeta = { name: 'Customer', fields: [] };
      const engine = new MetadataEngine({ db: mockDb, cache: mockCache });
      engine._cache.set('Customer', mockMeta); // Pre-populate cache

      // Act
      const result = await engine.getDocMeta('Customer');

      // Assert
      expect(result).toEqual(mockMeta);
      expect(mockCache.get).not.toHaveBeenCalled(); // Redis was not called
      expect(mockDb).not.toHaveBeenCalled();        // DB was not called
    });

    it('should return null if DocType does not exist', async () => {
      // Arrange
      const engine = new MetadataEngine({ db: mockDbEmpty, cache: mockCacheMiss });

      // Act
      const result = await engine.getDocMeta('NonExistentDocType');

      // Assert
      expect(result).toBeNull();
    });
  });
});
```

### Mocking Rules
- Always mock external dependencies (Database, Redis, External API).
- Never mock the class/function being tested.
- Use `vi.fn()` (Vitest) or `jest.fn()` for mocks.

---

## 3. Integration Test Rules

### Target
- All REST API endpoints (`GET`, `POST`, `PUT`, `DELETE`, `POST /:id/submit`, etc.).
- Must use a **separate test database** (never run integration tests against the development or production database).

### Test Database Setup
- Use the environment variable `APP_ENV=test` to point to the `framee_test` database.
- Before each test suite: run migrations, seed minimal data.
- After each test: clean up (truncate) the tables that were touched.

### Integration Test Pattern with Supertest

```javascript
// tests/integration/crud.test.js
import request from 'supertest';
import { app } from '../../src/server.js';
import { db } from '../../src/database/connection.js';

describe('POST /api/v1/doc/Customer', () => {
  let authToken;

  beforeAll(async () => {
    // Login to get a token
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'test@framee.io', password: 'testpassword' });
    authToken = res.body.data.access_token;
  });

  afterEach(async () => {
    // Clean up test data
    await db('dt_customer').where({ tenant_id: 'tenant-test' }).delete();
  });

  it('should create a customer and return 201', async () => {
    const res = await request(app)
      .post('/api/v1/doc/Customer')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ customer_name: 'PT. Test', customer_type: 'Company' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.customer_name).toBe('PT. Test');
    expect(res.body.data.status).toBe('Draft');
  });

  it('should return 422 if customer_name is missing', async () => {
    const res = await request(app)
      .post('/api/v1/doc/Customer')
      .set('Authorization', `Bearer ${authToken}`)
      .send({});

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
```

---

## 4. Test Naming Rules

- Test files: `{TargetFile}.test.js` alongside the file being tested, or in a `tests/` folder.
- Describe block name: name of the class or module (`describe('MetadataEngine', ...)`)
- `it` block name: descriptive sentence following the pattern `should [verb] [expected result] [condition]`.
  - ✅ `'should return 403 if user lacks delete permission'`
  - ❌ `'test delete'`

---

## 5. Coverage Targets (MVP)

| Layer | Target Coverage |
|-------|----------------|
| Core Engines (`src/core/`) | ≥ 80% |
| Service Layer (`src/modules/`) | ≥ 70% |
| API Endpoints (Integration Test) | 100% happy path + main error cases |
| Frontend Hooks (`hooks/`) | ≥ 60% |

---

## 6. Running Tests

```bash
# Unit tests only (fast)
npm run test:unit

# Integration tests (requires test DB)
npm run test:integration

# All tests + coverage report
npm run test:coverage
```

Tests must be runnable in a CI/CD environment (GitHub Actions) automatically on every push to the `develop` or `main` branch.
