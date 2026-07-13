# 10-02 Unit Test Patterns

## Purpose

Provides concrete examples and patterns for writing unit tests in Framee. Unit tests target Core Engines and utility functions in isolation, heavily utilizing mocks for external dependencies (like the database or Redis).

---

## 1. Testing Core Engines (Singleton Mocking)

Since Core Engines are Singletons resolved via a DI Container, we need to mock the dependencies they request.

### Example: Testing `PermissionEngine`

```javascript
// tests/unit/PermissionEngine.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PermissionEngine from '../../src/core/PermissionEngine';
import Container from '../../src/core/Container';

describe('PermissionEngine', () => {
  let dbMock;
  let cacheMock;

  beforeEach(() => {
    // 1. Create mocks for dependencies
    dbMock = {
      query: vi.fn()
    };
    cacheMock = {
      get: vi.fn(),
      set: vi.fn()
    };

    // 2. Register mocks to Container
    Container.register('DatabaseEngine', dbMock);
    Container.register('CacheEngine', cacheMock);
  });

  it('should return true if user is System Manager', async () => {
    const engine = PermissionEngine.getInstance();
    
    // Mock user data
    const user = { id: 'u1', roles: ['System Manager'] };
    
    const result = await engine.hasPermission(user, 'Customer', 'can_read');
    
    expect(result).toBe(true);
    // Database should not be queried if user is System Manager
    expect(dbMock.query).not.toHaveBeenCalled(); 
  });
});
```

---

## 2. Testing Pure Functions (Utils)

Utility functions are the easiest to test. They should have 100% coverage.

```javascript
// tests/unit/utils/string.test.js
import { describe, it, expect } from 'vitest';
import { toSnakeCase } from '../../src/utils/string';

describe('toSnakeCase', () => {
  it('converts PascalCase to snake_case', () => {
    expect(toSnakeCase('SalesInvoice')).toBe('sales_invoice');
  });

  it('handles already snake_case strings', () => {
    expect(toSnakeCase('customer_group')).toBe('customer_group');
  });
});
```

---

## 3. Mocking Timers and Dates

When testing logic that depends on `new Date()`, use Vitest's fake timers to ensure deterministic tests.

```javascript
import { vi, beforeAll, afterAll } from 'vitest';

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-13T10:00:00Z'));
});

afterAll(() => {
  vi.useRealTimers();
});
```

---

## 4. Testing Error Throws

Always test that functions throw the correct `FrameeError` subclass.

```javascript
import { expect, it } from 'vitest';
import { ValidationError } from '../../src/utils/errors';

it('should throw ValidationError if email is missing', async () => {
  const payload = { name: 'Budi' }; // missing email
  
  await expect(authService.register(payload))
    .rejects
    .toThrow(ValidationError);
});
```
