# 06-04 Folder Rules

## Purpose

Rules about where files should be placed. If a developer or AI agent is uncertain where to put a file, this document is the reference.

---

## 1. Backend (`apps/backend/src/`)

### When to create a file in `api/controllers/`?
Only for **Controller classes** that accept `req` and `res`. One controller per major domain/feature, NOT one controller per DocType.

✅ Correct: `api/controllers/GenericController.js` (handles all DocTypes)
✅ Correct: `api/controllers/AuthController.js`
❌ Wrong: `api/controllers/CustomerController.js` (too specific, unnecessary)

---

### When to create a file in `api/middlewares/`?
For Express functions that intercept `(req, res, next)` globally or per-router.

Files that belong here:
- `authMiddleware.js`
- `tenantMiddleware.js`
- `rateLimitMiddleware.js`
- `errorHandlerMiddleware.js`

---

### When to create a file in `core/`?
For **Singleton Engines** that form the foundation of the entire system. Each Engine has its own subfolder:

```
core/
├── MetadataEngine/
│   ├── MetadataEngine.js   ← Main class
│   └── MetadataEngine.test.js
├── CRUDEngine/
├── EventEngine/
└── ...
```

**Do not** create files in `core/` if the logic is specific to one business feature. Use `modules/` instead.

---

### When to create a file in `modules/`?
For the **Service Layer** containing specific business logic. Each module has its own subfolder:

```
modules/
├── auth/
│   ├── auth.service.js
│   ├── auth.events.js
│   └── index.js
├── audit/
└── notification/
```

---

### When to create a file in `database/migrations/`?
Every time there is a database schema change (CREATE, ALTER, DROP TABLE/COLUMN). One change = one migration file.

File name format: `{timestamp}_{short_description}.js`
Example: `20260713_create_sys_user.js`

---

## 2. Frontend (`apps/frontend/src/`)

### When to create a file in `pages/`?
Only for **pages** accessed via browser URL. Follow Next.js Pages Router conventions:

```
pages/
├── auth/login.js          ← /auth/login
├── doctype/[doctype].js   ← /doctype/Customer
├── document/[doctype]/
│   ├── new.js             ← /document/Customer/new
│   └── [id].js            ← /document/Customer/abc-123
```

**Do not** create `pages/customer/list.js`. Always use the dynamic route `[doctype]`.

---

### When to create a file in `components/core/`?
For **reusable UI components** that do not depend on Framee metadata or global state.

Files that belong here:
- `Button.jsx`, `Input.jsx`, `Badge.jsx`
- `Modal.jsx`, `Drawer.jsx`
- `Table.jsx` (headless, accepts columns & data via props)

---

### When to create a file in `components/dynamic/`?
For **components rendered based on DocType metadata**.

- `DynamicForm/` — Form whose fields are rendered from `meta.fields`
- `DynamicList/` — Table whose columns come from `meta.fields` with `in_list_view = 1`
- `FieldTypes/` — Input components for each field type (DataField, LinkField, SelectField, etc.)

---

### When to create a file in `store/`?
Only for **Zustand stores** that hold global state shared across pages.

Rule: If state is only needed by a single page or component, use `useState` — do not create a new Zustand store.

---

### When to create a file in `hooks/`?
For **custom React hooks** that encapsulate repeated logic.

Files that belong here:
- `useDocMeta(doctype)` — Fetches DocType metadata, stores in Zustand if not already cached.
- `usePermissions(doctype)` — Checks the current user's access rights for a given DocType.
- `useActivityTimeline(doctype, docId)` — Fetches log data and provides comment/like functions.

---

## 3. Prohibited Patterns

| Prohibited | Reason |
|------------|--------|
| Business logic in `pages/` | Pages are only for orchestration, not logic |
| Raw SQL directly in `modules/` | Always go through the Repository Pattern |
| Files created directly at the root of `src/` | Everything must be organized in subfolders |
| Duplicating components between `core/` and `dynamic/` | Choose the correct one based on its function |
