# 06-01 Prompt Rules

## Purpose

Guidelines for interacting with AI agents (such as Antigravity, Copilot, or ChatGPT) when developing Framee. These rules ensure AI consistently produces output that is safe, consistent, and aligned with the established architecture.

---

## 1. Mandatory Context to Include

Every time starting a new AI session for Framee work, include the following context:

```
We are building Framee — a Metadata-Driven ERP Framework.

Stack:
- Backend: Express.js 5.x
- Frontend: Next.js 15 (Pages Router)
- Database: MySQL 8.x
- Cache: Redis 8.x
- ORM/Query: Knex.js
- State: Zustand
- UI: Tailwind CSS + Lucide Icons
- Table: TanStack Table
- Form: React Hook Form + Zod
- HTTP Client: Axios

Architectural Principles:
- Metadata-Driven: All forms & tables are rendered from DocType metadata.
- Plugin-First: Core does not import Plugins. Plugins register via Event Hooks.
- Event-Driven: All side-effects (audit, notifications) react to events.
- Status-Driven: Use the 'status' column, never 'is_deleted' or 'is_locked'.
- Tenant-Isolated: Every query MUST include tenant_id.

Reference documents are in the /docs folder.
```

---

## 2. Format of Effective Instructions

### ✅ Good Instruction

```
Create the file src/core/MetadataEngine/MetadataEngine.js.
This class is a Singleton. The constructor accepts { db, cache, events } via DI.
Method: getDocMeta(doctype) — check the in-memory Map first, then Redis, then MySQL.
Use logger for every cache hit/miss level.
Include JSDoc on every method.
```

### ❌ Bad Instruction

```
Make a metadata engine.
```

---

## 3. Prompt Rules for Code Generation

1. **Always state the full file path** — `src/core/CRUDEngine/CRUDEngine.js`, not just "create a CRUD file".
2. **State the expected class/function names** — do not let the AI guess.
3. **State dependencies** — "accepts DatabaseEngine and EventEngine via constructor".
4. **State the error format** — "throw FrameeError, not a plain Error".
5. **Specify the module system** — "use ES Modules (import/export), not CommonJS (require)".
6. **Do not ask AI to "build everything at once"** — request one file/function per session for better quality.

---

## 4. Validating AI Output

Before accepting code from AI, check:
- [ ] Are there any `require()` that should be `import`?
- [ ] Are there any `console.log` that should be `logger.*`?
- [ ] Do all DB queries include `tenant_id`?
- [ ] Do thrown errors use the correct `FrameeError` class?
- [ ] Are there any hardcoded strings that should come from config/env?
- [ ] Is there any business logic in a Controller (it should be in a Service)?

---

## 5. Forbidden Phrases in Prompts

Avoid these phrases because they commonly produce non-compliant output:
- ❌ "Keep it simple"
- ❌ "Use the fastest way"
- ❌ "Just make an MVP first"
- ❌ "Skip error handling for now"
- ❌ "Skip the tenant check for now"

> All code entering the repository must meet full standards. There is no "fix it later".

---

## 6. Prompts for Documentation

When asking AI to update documentation in `/docs`:

```
Update the file /docs/05-DATABASE/05-06-audit-tables.md.

Add a new section after section 4 (Likes) about:
"How to read the Activity Timeline with a single query".

Write in English, Markdown format.
Do not modify any other part of the file.
```
