# 99-01 Implementation Milestone & Order

## Purpose

This document defines the execution order (Development Order) for the implementation of Framee. The approach used is **Bottom-Up** (from the database foundation, core engines, up to the frontend) to ensure every layer is built upon a solid foundation.

Each engine/component has a **Definition of Done (DoD)** that must be met before moving to the next stage.

---

## Development Order

Framee implementation is divided into 3 major phases: **Foundation**, **Core Framework**, and **Frontend & UI**. Do not jump to building business modules (like Sales or Accounting) before Phase 3 is completed.

### Phase 1: Foundation (Backend Core)
1. **Database Engine** (01-02)
2. **Metadata Engine** (01-01)
3. **Cache Engine** (01-05)
4. **Event Engine** (01-06)

### Phase 2: Application Framework
5. **API Engine** (01-04)
6. **CRUD Engine** (01-03)
7. **Document Lifecycle Engine** (01-09)
8. **Authentication & Identity** (System)
9. **Permission Engine** (01-07)
10. **Audit Engine & Version Engine** (01-10, 01-11)

### Phase 3: Frontend & System DocTypes
11. **Next.js Foundation & UI Design System**
12. **System DocTypes** (Module, DocType, DocField, Role, User)
13. **Dynamic List** (03-03)
14. **Dynamic Form** (03-02)
15. **Dynamic Layout & Menu** (03-04)

---

## Definition of Done (DoD) Per Milestone

### 1. Database Engine
- [ ] Connection to MySQL with Connection Pool (Knex.js).
- [ ] Tenant Scoping runs automatically at the query builder level.
- [ ] Soft Delete filtering (`status != 'Deleted'`) is integrated.
- [ ] Transaction wrapping is supported.
- [ ] *Test: Can perform isolated INSERT and SELECT per tenant.*

### 2. Metadata Engine
- [ ] Basic structure for `sys_doctype` and `sys_docfield` tables created.
- [ ] Initial sync/migration scripts to seed core metadata.
- [ ] Function to load schema into memory/Cache.
- [ ] *Test: Calling getDocMeta("User") returns the correct field structure.*

### 3. API Engine & CRUD Engine
- [ ] Generic route `/api/v1/doc/:doctype` is available.
- [ ] CRUD Operations (Create, Read, Update, Delete) are successfully executed.
- [ ] Input validation works based on Metadata (DocField) definitions.
- [ ] *Test: POST `/api/v1/doc/TestDoc` successfully saves to `dt_test_doc` table.*

### 4. Lifecycle & Permission Engine
- [ ] Status transitions (Draft -> Submitted -> Locked) are guarded by the gate.
- [ ] Role-based authorization checks are performed before CRUD execution.
- [ ] Field Level Permission authorization works.
- [ ] *Test: User without 'Delete' rights gets a 403 error when trying to DELETE.*

### 5. Frontend Foundation & UI System
- [ ] Next.js Pages Router setup with TailwindCSS is complete.
- [ ] Creation of basic Design System components (Button, Input, Table, Card, Modal, etc).
- [ ] Zustand integration for State Management (User, Metadata).
- [ ] Axios interceptors integration for JWT Auth.

### 6. Dynamic List & Dynamic Form
- [ ] `/doctype/[doctype]` can render the List view based on `in_list_view`.
- [ ] Sorting, Pagination, and Standard Filters work in the List view.
- [ ] ViewModal (👁️) and Activity Timeline (Logs) display correctly.
- [ ] `/document/[doctype]/[id]` renders the Form view based on DocField definitions.
- [ ] Form responds to Lifecycle (Submit button appears, form becomes read-only if Locked).

---

## General Coding Checklist (For Developers & AI)

Before declaring a feature / file "Done", check the following points:
- **Linting**: No ESLint / TypeScript errors.
- **Naming**: Complies with `05-01-naming-convention.md`.
- **Tenant Isolation**: Ensure every query / operation does not "leak" to other tenants.
- **Error Handling**: All try/catch blocks throw structured errors (using the `FrameeError` class).
- **Logs**: Add `logger.info()` / `logger.debug()` at crucial operation points (not for audit data, but for dev/ops observability).
- **Hardcode**: No hardcoded variables related to business logic. Use metadata.
