# 04-03 Folder Structure

## Purpose

Documents the standard directory structure for Framee's backend (Express) and frontend (Next.js). A consistent folder structure is essential for easy navigation and proper Separation of Concerns.

---

## 1. Root Repository Structure

Framee separates the core backend and frontend into independent directories under `apps/` within the same repository. There is no root `package.json` (it is not an npm workspace monorepo).

```text
framee/
├── apps/
│   ├── backend/          # Express.js API Server
│   └── frontend/         # Next.js 15 (Pages Router) Client
├── docs/                 # Blueprint & PRD documentation
```

---

## 2. Backend Structure (`apps/backend`)

The backend applies a modular architecture that separates the Gateway (API), Core Engines, Services, and Repositories.

```text
apps/backend/
├── src/
│   ├── api/                  # Gateway Layer (Express)
│   │   ├── controllers/      # Route handlers
│   │   ├── middlewares/      # auth, tenant, rate limiter, error handler
│   │   └── routes/           # Route definitions (static & dynamic generator)
│   │
│   ├── core/                 # Core Engines Layer
│   │   ├── MetadataEngine/
│   │   ├── CRUDEngine/
│   │   ├── PermissionEngine/
│   │   ├── EventEngine/
│   │   └── WorkflowEngine/
│   │
│   ├── modules/              # Business Logic (Service Layer)
│   │   ├── auth/             # Login, JWT, Password reset
│   │   ├── system/           # Core system module logic
│   │   └── audit/            # Audit log logic
│   │
│   ├── database/             # Database Layer
│   │   ├── migrations/       # Knex migration files
│   │   ├── seeds/            # Initial data seeds
│   │   └── connection.js     # Knex initialization
│   │
│   ├── config/               # Environment & App Config
│   ├── utils/                # Helper functions (logger, formatting)
│   └── server.js             # Express app entry point
│
├── tests/                    # Backend unit & integration tests
├── .env                      # Environment variables
└── package.json
```

---

## 3. Frontend Structure (`apps/frontend`)

The frontend uses **Next.js 15 with Pages Router**. The structure prioritizes dynamic components that render UI based on metadata.

```text
apps/frontend/
├── src/
│   ├── pages/                # Next.js Pages Router
│   │   ├── api/              # Next.js API Routes (BFF - Backend for Frontend)
│   │   ├── auth/
│   │   │   └── login.js      # Login page
│   │   ├── doctype/
│   │   │   └── [doctype].js  # Dynamic List View
│   │   ├── document/
│   │   │   └── [doctype]/
│   │   │       ├── new.js    # Dynamic Form (Create)
│   │   │       └── [id].js   # Dynamic Form (Edit/View)
│   │   ├── _app.js           # App wrapper, global providers
│   │   └── _document.js      # HTML document template
│   │
│   ├── components/           # UI Components
│   │   ├── core/             # Design System (Button, Input, Modal, Badge)
│   │   ├── dynamic/          # Metadata-driven components
│   │   │   ├── DynamicForm/  # Form renderer based on DocFields
│   │   │   ├── DynamicList/  # Table renderer (TanStack Table)
│   │   │   └── FieldTypes/   # Input components for each fieldtype
│   │   └── layout/           # AppLayout, Sidebar, Navbar
│   │
│   ├── store/                # Zustand Stores
│   │   ├── useUserStore.js   # Auth & Session state
│   │   └── useMetaStore.js   # Cached DocType metadata
│   │
│   ├── hooks/                # Custom React Hooks
│   │   ├── usePermissions.js # Client-side permission check
│   │   └── useApi.js         # Axios wrapper hooks
│   │
│   ├── lib/                  # Utilities & Configurations
│   │   └── axios.js          # Axios instance with interceptors
│   │
│   └── locales/              # i18n Translation files (en, id, etc.)
│
├── public/                   # Static assets (images, fonts)
├── styles/                   # Tailwind CSS global styles
├── tailwind.config.js
├── jsconfig.json
└── package.json
```

---

## 4. Plugin Structure (`packages/plugins`)

Each plugin has an isolated structure similar to the main architecture, but registers itself to Core through hooks.

```text
packages/plugins/hris/
├── backend/
│   ├── migrations/           # Plugin-specific DB migrations
│   ├── services/             # HRIS custom business logic
│   ├── events/               # Event listeners (e.g., onEmployeeCreate)
│   └── index.js              # Plugin entry point (registers hooks & routes)
│
├── frontend/
│   ├── components/           # Custom HRIS UI components
│   └── pages/                # Custom HRIS pages (if any)
│
└── plugin.json               # Plugin metadata (name, version, dependencies)
```

---

## Rules & Conventions

1. **No Circular Dependencies**: Modules in `src/core` must not circularly import each other. Use the Event Engine for inter-engine communication to break cycles.
2. **Gateway vs Core**: Middleware in `src/api/middlewares` only deals with HTTP request/response. Business logic and document authorization must live in `src/core` or `src/modules`.
3. **Dynamic Over Static**: On the frontend, avoid creating specific page files like `pages/customer/list.js`. Always use `pages/doctype/[doctype].js` unless the route requires a 100% custom UI that cannot be served by the Dynamic Layout.
