# 10-03 Integration Test Patterns

## Purpose

Provides concrete patterns for writing integration tests in Framee. Integration tests cover the full HTTP request lifecycle using Express and a real (test) MySQL database.

---

## 1. Test Environment Setup

Integration tests use `supertest` to make HTTP requests against the Express app instance.

```javascript
// tests/helpers/setup.js
import request from 'supertest';
import app from '../../src/app'; // The Express app (unstarted)
import { knex } from '../../src/config/database';

export const api = request(app);
export const db = knex;

export const TEST_TENANT = 'tenant-test-123';
```

---

## 2. API Endpoint Testing Example

Testing a standard CRUD endpoint. Notice how we use `beforeEach` to clear the table to ensure isolation.

```javascript
// tests/integration/customerApi.test.js
import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { api, db, TEST_TENANT } from '../helpers/setup';
import { getAuthToken } from '../helpers/auth';

describe('Customer API', () => {
  let token;

  beforeAll(async () => {
    // Generate a valid JWT for the test tenant
    token = await getAuthToken({ roles: ['Sales User'], tenant_id: TEST_TENANT });
  });

  beforeEach(async () => {
    // Clean up table before each test
    await db('dt_customer').where({ tenant_id: TEST_TENANT }).delete();
  });

  it('POST /api/v1/doc/Customer should create a new record', async () => {
    const payload = {
      customer_name: 'PT. Test',
      customer_type: 'Company'
    };

    const res = await api
      .post('/api/v1/doc/Customer')
      .set('Authorization', `Bearer ${token}`)
      .send(payload);

    // 1. Verify HTTP status
    expect(res.status).toBe(201);
    
    // 2. Verify response structure
    expect(res.body.success).toBe(true);
    expect(res.body.data.customer_name).toBe('PT. Test');
    expect(res.body.data.id).toBeDefined();

    // 3. Verify Database state
    const dbRecord = await db('dt_customer')
      .where({ id: res.body.data.id, tenant_id: TEST_TENANT })
      .first();
      
    expect(dbRecord).toBeDefined();
    expect(dbRecord.status).toBe('Draft');
  });

  it('POST /api/v1/doc/Customer should return 422 if required field missing', async () => {
    const payload = { customer_type: 'Company' }; // missing customer_name

    const res = await api
      .post('/api/v1/doc/Customer')
      .set('Authorization', `Bearer ${token}`)
      .send(payload);

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
```

---

## 3. Seeding Test Data

For testing updates or reads, you must seed data directly into the DB first.

```javascript
it('GET /api/v1/doc/Customer/:id should return document', async () => {
  const customerId = 'cust-id-1';
  
  // Seed data directly using Knex
  await db('dt_customer').insert({
    id: customerId,
    tenant_id: TEST_TENANT,
    name: 'CUST-0001',
    customer_name: 'PT. Existing',
    status: 'Draft',
    created_at: new Date(),
    updated_at: new Date()
  });

  // Make API request
  const res = await api
    .get(`/api/v1/doc/Customer/${customerId}`)
    .set('Authorization', `Bearer ${token}`);

  expect(res.status).toBe(200);
  expect(res.body.data.customer_name).toBe('PT. Existing');
});
```

---

## 4. Best Practices for Integration Tests

1. **Do not rely on previous tests**: Every `it` block must be able to run independently.
2. **Clean up DB state**: Always delete inserted rows in `beforeEach` or `afterEach`.
3. **Mock External APIs**: If an endpoint calls a third-party API (e.g., Stripe, Sendgrid), use `nock` or Vitest mocks to intercept that HTTP call. Never make real external network requests in tests.
