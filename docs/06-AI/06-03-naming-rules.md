# 06-03 Naming Rules

## Purpose

Naming conventions applied across the entire Framee codebase — from file names, classes, functions, and variables to constants. Consistent naming is the key to long-term code readability.

---

## 1. Files & Folders

| Context | Convention | Example |
|---------|-----------|---------|
| Folder name | kebab-case | `metadata-engine/`, `crud-engine/` |
| JavaScript backend file | PascalCase (if class) | `MetadataEngine.js`, `CRUDEngine.js` |
| JavaScript backend file | camelCase (if non-class) | `knexConfig.js`, `logger.js` |
| Next.js page file | camelCase | `[doctype].js`, `login.js` |
| React component file | PascalCase | `DynamicForm.jsx`, `ActivityTimeline.jsx` |
| Config/env file | SCREAMING_SNAKE_CASE | `.env`, config key: `AUDIT_ENABLED` |
| Test file | `*.test.js` or `*.spec.js` | `MetadataEngine.test.js` |

---

## 2. JavaScript — Backend

| Context | Convention | Example |
|---------|-----------|---------|
| Class | PascalCase | `MetadataEngine`, `CRUDEngine` |
| Method | camelCase | `getDocMeta()`, `insertRecord()` |
| Variable | camelCase | `tenantId`, `docMeta`, `userRole` |
| Constant | SCREAMING_SNAKE_CASE | `DEFAULT_PAGE_SIZE`, `MAX_RETRY` |
| Private property (by convention) | `_` prefix + camelCase | `this._cache`, `this._conn` |
| Boolean variable | `is*` or `has*` prefix | `isActive`, `hasPermission` |
| Async function | Same as sync, no "async" suffix | `fetchUser()` not `fetchUserAsync()` |
| Event name | dot-notation, PascalCase.eventName | `Customer.after_insert`, `user.login` |

---

## 3. JavaScript — Frontend (React/Next.js)

| Context | Convention | Example |
|---------|-----------|---------|
| React component | PascalCase | `DynamicForm`, `ActivityTimeline` |
| Custom Hook | `use` + PascalCase | `usePermissions`, `useDocMeta` |
| Zustand store | `use` + PascalCase + `Store` | `useUserStore`, `useMetaStore` |
| Props | camelCase | `docType`, `onSave`, `isLoading` |
| Event handler prop | `on` + PascalCase | `onSubmit`, `onCancel`, `onChange` |
| Local handler function | `handle` + PascalCase | `handleSubmit`, `handleCancel` |
| CSS class (Tailwind) | No special naming — use Tailwind utilities directly |

---

## 4. Database

See `05-01-naming-convention.md` for the complete database naming rules.

Summary:
- Tables: `sys_*` (system), `dt_*` (DocType data), `dt_*_logs`, `dt_*_likes`
- Columns: `snake_case`
- FK: `{table_singular}_id`
- Boolean: `is_{adjective}`
- Index: `idx_{table}_{column}`

---

## 5. API Endpoints

- Use `kebab-case` for path segments: `/api/v1/doc/sales-invoice` ✅
- Use `:camelCase` for path parameters: `/api/v1/doc/:doctype/:id` ✅
- Use `snake_case` for query parameters: `?page_size=20` ✅
- Use semantically correct HTTP methods:
  - `GET` → Read
  - `POST` → Create / Action (submit, lock)
  - `PUT` → Full update
  - `PATCH` → Partial update (rarely used in Framee)
  - `DELETE` → Delete (soft delete)

---

## 6. Environment Variables

All external configuration must be read from environment variables using `SCREAMING_SNAKE_CASE`.

Prefix by context:
- `DB_*` → Database (e.g., `DB_HOST`, `DB_PORT`, `DB_NAME`)
- `REDIS_*` → Redis (e.g., `REDIS_HOST`, `REDIS_PORT`)
- `JWT_*` → Auth (e.g., `JWT_SECRET`, `JWT_EXPIRES_IN`)
- `AUDIT_*` → Audit engine config
- `MAIL_*` → Email service
- `APP_*` → General (e.g., `APP_PORT`, `APP_ENV`)

---

## 7. Git Commit Messages

Format: `type(scope): short description`

| Type | When |
|------|------|
| `feat` | Adding a new feature |
| `fix` | Fixing a bug |
| `docs` | Documentation changes only |
| `refactor` | Refactor with no functional change |
| `test` | Adding/updating tests |
| `chore` | Config, dependency update |
| `db` | Database migration |

Examples:
```
feat(crud): add optimistic locking via version column
fix(audit): prevent audit write from rolling back document save
docs(database): add relationship rules to 05-10
db(user): add last_login column to sys_user
```
