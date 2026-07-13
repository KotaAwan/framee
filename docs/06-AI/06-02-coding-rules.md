# 06-02 Coding Rules

## Purpose

Mandatory coding rules that must be followed by all developers and AI agents contributing to the Framee codebase. These rules apply to both backend (Express.js) and frontend (Next.js).

---

## 1. General Rules

| No | Rule | Correct | Wrong |
|----|------|---------|-------|
| 1 | Use ES Modules | `import x from 'y'` | `const x = require('y')` |
| 2 | Use `async/await` | `const data = await fn()` | `fn().then(...)` |
| 3 | Use logger, not console | `logger.info('...')` | `console.log('...')` |
| 4 | Throw FrameeError, not Error | `throw new ValidationError(...)` | `throw new Error(...)` |
| 5 | JSDoc on all public methods | `/** @param {string} id */` | (no comments) |
| 6 | One file, one responsibility | `MetadataEngine.js` for metadata only | Don't mix service+controller |
| 7 | No hardcoded configuration | `process.env.JWT_SECRET` | `'my-secret-key'` |

---

## 2. Backend (Express.js)

### 2.1 Controller Layer
- Controllers ONLY accept requests, call service/engine, and return responses.
- Controllers must NOT contain business logic.
- Controllers must NOT call the database directly.

```javascript
// ✅ Correct
async create(req, res, next) {
  try {
    const result = await this.crudEngine.create({
      doctype: req.params.doctype,
      data: req.body,
      user: req.user,
      tenantId: req.tenant.id
    });
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// ❌ Wrong — business logic in controller
async create(req, res, next) {
  const existing = await db('dt_customer').where({ email: req.body.email }).first();
  if (existing) return res.status(409).json({ error: 'Email already exists' });
  // ...
}
```

### 2.2 Service Layer
- Services accept plain objects, NOT `req` or `res`.
- Services may perform DB queries through Repositories.
- Services may call other Engines through the DI Container.

### 2.3 Database Queries
- All queries MUST include `tenant_id`.
- Always use parameterized queries (Knex builder), no raw SQL strings.

```javascript
// ✅ Correct
db('dt_customer').where({ tenant_id: tenantId, id }).first();

// ❌ Wrong — SQL injection risk + no tenant isolation
db.raw(`SELECT * FROM dt_customer WHERE id = '${id}'`);
```

---

## 3. Frontend (Next.js)

### 3.1 Page Components
- Pages in `pages/` only fetch data (via Axios) and pass it to components.
- No complex UI logic inside `pages/` files.

### 3.2 Components
- UI components in `components/core/` must be pure — not dependent on global state.
- Components that depend on metadata must receive `meta` as a prop, not fetch it directly from the API.

### 3.3 State Management
- Use Zustand for state that needs to be shared across pages (user, tenant, metadata cache).
- Use `useState`/`useReducer` for local component state.
- Do not use Zustand for state that does not need to be global.

---

## 4. Error Handling

- Backend: Always use `try/catch` and call `next(err)`. Never return errors inside a catch block without calling next.
- Frontend: Use axios interceptors to handle `401` (redirect to login) and global errors.

```javascript
// Backend ✅
try {
  const data = await service.doSomething();
  res.json({ success: true, data });
} catch (err) {
  next(err); // Caught by global error handler
}

// Frontend ✅
try {
  const { data } = await api.post('/doc/Customer', payload);
  return data;
} catch (err) {
  // Axios interceptor already handles 401
  // Re-throw so the component can handle it
  throw err;
}
```

---

## 5. Naming Code

See `06-03-naming-rules.md` for complete naming guidelines.

---

## 6. Code Comments & Documentation

- Write comments in **English** inside code (international standard).
- JSDoc is mandatory for every **public method** and **exported function**.
- Do not comment on things that are already obvious from the code itself.

```javascript
// ❌ Wrong — useless comment
const x = x + 1; // add 1 to x

// ✅ Correct — explains "why"
// Increment version to trigger optimistic lock check on next concurrent save
doc.version += 1;
```

---

## 7. Absolute Prohibitions

1. ❌ `process.exit()` outside the bootstrap startup sequence.
2. ❌ `eval()` or `new Function()`.
3. ❌ Storing credentials (passwords, API keys) in code or in files committed to Git.
4. ❌ Modifying standard columns (`id`, `tenant_id`, `status`, etc.) from inside a custom DocField.
5. ❌ Any query without `tenant_id` on `dt_*` or `sys_*` tables.
