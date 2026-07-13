# 00-04 Folder Structure

## Purpose

This document defines the **official folder structure** for the Framee ERP Framework. A well-defined folder structure is foundational to a maintainable, scalable codebase — especially in an ERP system where multiple teams, plugins, and modules coexist.

This document is the authoritative reference for where every type of file belongs. It eliminates ambiguity, prevents structural drift, and enables AI agents and automated tooling to navigate the codebase reliably.

---

## Goals

1. Establish a predictable, consistent directory layout for backend, frontend, and plugin code.
2. Enable Clean Architecture by enforcing separation of concerns at the file system level.
3. Make the codebase navigable without deep system knowledge — **a new developer should understand the routing by reading the folder names alone**.
4. Support Plugin First architecture with dedicated plugin directories and a standardized internal structure.
5. Ensure AI agents can infer file locations from context without manual directory exploration.

---

## Scope

### In Scope
- Backend (ExpressJS) folder structure
- Frontend (Next.js Pages Router) folder structure
- Plugin directory structure
- Shared/common packages structure
- Configuration and environment file placement

### Out of Scope
- Infrastructure as Code files (Terraform, Kubernetes YAML) — covered in Development Constitution
- CI/CD pipeline configuration files — covered in Development Constitution
- Documentation files (stored in `/prd/`) — not part of the runtime structure

---

## Functional Requirements

### FR-001 Predictability
- Any developer must be able to locate any type of file based solely on this document.
- No exceptions in file placement are allowed without documented justification.

### FR-002 Pages Router Clarity
- Frontend routing must be self-documenting through the `pages/` directory structure.
- The route `/app/module/accounting` must correspond to `pages/module/[module].js`.
- A new developer must be able to understand all available routes by listing the `pages/` directory.

### FR-003 Separation of Concerns
- Business logic must be separated from infrastructure logic at the directory level.
- No database queries in route handlers. No HTTP logic in engines.

### FR-004 Plugin Isolation
- Each plugin must live in its own subdirectory under `/plugins/`.
- Plugins must not reference each other's internal files directly.

### FR-005 Environment Safety
- `.env` files must never be committed to version control.
- Example `.env.example` files must be committed and kept up to date.

---

## Architecture

The repository is organized as a **monorepo** with three primary top-level areas:

```
framee/
├── backend/          ← ExpressJS API server
├── frontend/         ← Next.js Pages Router application
├── plugins/          ← First-party and third-party plugins
├── shared/           ← Shared constants, types, i18n helpers
├── prd/              ← Product Requirement Documents
├── .env.example      ← Environment variable template
├── .gitignore
└── README.md
```

---

## Database Design

_Not applicable. Folder structure is a structural governance artifact._

---

## API Design

_Not applicable._

---

## UI Behaviour

_Not applicable._

---

## Configuration

| Config | Location | Description |
|--------|----------|-------------|
| Backend environment | `backend/.env` | Database, Redis, JWT secrets |
| Frontend environment | `frontend/.env.local` | API URL, public config |
| Plugin manifest | `plugins/{name}/plugin.manifest.json` | Plugin capability declaration |
| Tailwind config | `frontend/tailwind.config.js` | Design token system |
| ESLint config | `backend/.eslintrc.js` / `frontend/.eslintrc.js` | Linting rules |
| Prettier config | `.prettierrc` (root) | Shared formatting rules |

---

## Validation Rules

- Every plugin directory must contain `plugin.manifest.json` at its root.
- Route files in `pages/` must only handle page rendering — data fetching is via API calls or `getServerSideProps`.
- Engine files must not import from route or controller files (Clean Architecture: dependencies flow inward).
- Database migration files must be numbered sequentially and never modified after deployment.
- Test files mirror source file structure.

---

## Security

- `backend/.env` must be in `.gitignore`. Committing secrets is a critical security violation.
- Plugin code requires security review before merging into `plugins/`.
- No credentials or API keys are stored in `prd/` or `shared/` directories.

---

## Events

_Not applicable for folder structure governance._

---

## Performance

- Pages Router pages are individually code-split by Next.js automatically.
- Backend engine files are individually `require()`-able for lazy loading on startup.
- Plugin loading scans only the `plugins/` directory.

---

## Detailed Folder Structure

### Backend (`/backend`)

```
backend/
├── src/
│   ├── engines/                    ← Core engine implementations
│   │   ├── metadata.engine.js      ← Metadata Engine
│   │   ├── crud.engine.js          ← CRUD Engine
│   │   ├── api.engine.js           ← API Engine (route auto-generator)
│   │   ├── cache.engine.js         ← Cache Engine (Redis wrapper)
│   │   ├── event.engine.js         ← Event Engine (event bus)
│   │   ├── permission.engine.js    ← Permission Engine
│   │   └── workflow.engine.js      ← Workflow Engine
│   │
│   ├── routes/                     ← Express route definitions
│   │   ├── auth.routes.js
│   │   ├── meta.routes.js
│   │   ├── system.routes.js
│   │   └── dynamic.routes.js       ← Auto-generated DocType routes
│   │
│   ├── middleware/                 ← Express middleware
│   │   ├── auth.middleware.js      ← JWT verification
│   │   ├── tenant.middleware.js    ← Tenant context injection
│   │   ├── permission.middleware.js← Role-based access check
│   │   ├── validate.middleware.js  ← Request body validation
│   │   └── error.middleware.js     ← Global error handler
│   │
│   ├── services/                   ← Application service layer
│   │   ├── auth.service.js
│   │   ├── user.service.js
│   │   ├── doctype.service.js
│   │   └── translation.service.js  ← i18n / translation lookup
│   │
│   ├── repositories/               ← Database access layer (knex query builders)
│   │   ├── base.repository.js      ← Generic CRUD repository
│   │   ├── user.repository.js
│   │   └── doctype.repository.js
│   │
│   ├── plugins/                    ← Plugin loader and registry
│   │   ├── plugin.loader.js
│   │   └── plugin.registry.js
│   │
│   ├── config/                     ← Configuration loaders
│   │   ├── database.config.js
│   │   ├── redis.config.js
│   │   └── app.config.js
│   │
│   ├── utils/                      ← Pure utility functions
│   │   ├── logger.js               ← Winston logger
│   │   ├── response.helper.js      ← Standard response envelope
│   │   ├── uuid.util.js
│   │   └── date.util.js
│   │
│   └── app.js                      ← Express app factory (no listen())
│
├── database/
│   ├── migrations/                 ← Numbered migration files
│   │   ├── 001_create_sys_module.js
│   │   ├── 002_create_sys_doctype.js
│   │   ├── 003_create_sys_docfield.js
│   │   └── ...
│   └── seeds/                      ← Seed data for development
│       ├── 001_default_roles.js
│       └── 002_admin_user.js
│
├── tests/
│   ├── engines/
│   ├── routes/
│   ├── services/
│   └── fixtures/
│
├── .env.example
├── .eslintrc.js
├── package.json
└── server.js                       ← Entry point (calls app.listen())
```

---

### Frontend (`/frontend`)

> **Pages Router is the standard.** Every file in `pages/` becomes a URL route. The structure below is self-documenting — a developer reads the folder and knows every screen in the app.

```
frontend/
├── pages/                          ← Next.js Pages Router (routes = files)
│   ├── _app.js                     ← Global App wrapper (theme, auth, layout)
│   ├── _document.js                ← Custom HTML document
│   ├── index.js                    ← Redirect → /dashboard
│   │
│   ├── login.js                    ← /login
│   ├── forgot-password.js          ← /forgot-password
│   ├── reset-password.js           ← /reset-password
│   │
│   ├── dashboard.js                ← /dashboard (home dashboard)
│   │
│   ├── module/
│   │   └── [module].js             ← /module/accounting (module home)
│   │
│   ├── doctype/
│   │   └── [doctype].js            ← /doctype/Customer (Dynamic List)
│   │
│   ├── document/
│   │   └── [doctype]/
│   │       └── [name].js           ← /document/Customer/new OR /document/Customer/{id}
│   │                               ← (Dynamic Form — create or edit)
│   │
│   ├── settings/
│   │   ├── index.js                ← /settings (system settings home)
│   │   ├── module.js               ← /settings/module
│   │   ├── doctype.js              ← /settings/doctype
│   │   ├── role.js                 ← /settings/role
│   │   └── user.js                 ← /settings/user
│   │
│   └── profile.js                  ← /profile (user profile, theme, language)
│
├── components/
│   ├── layout/                     ← Shell layout components
│   │   ├── AppLayout.jsx           ← Main authenticated layout wrapper
│   │   ├── Sidebar.jsx             ← Left sidebar with navigation tree
│   │   ├── Header.jsx              ← Top header bar
│   │   ├── Breadcrumb.jsx          ← Breadcrumb navigation
│   │   ├── Toolbar.jsx             ← Page-level action bar (New, Filter, etc.)
│   │   ├── Content.jsx             ← Main content area wrapper
│   │   └── Footer.jsx              ← Optional footer bar
│   │
│   ├── navigation/                 ← Navigation tree components
│   │   ├── MenuTree.jsx            ← Full sidebar navigation tree
│   │   └── MenuItem.jsx            ← Single menu item (with children support)
│   │
│   ├── cards/                      ← Card components
│   │   ├── Card.jsx                ← Generic content card
│   │   └── StatCard.jsx            ← Dashboard KPI/stat card
│   │
│   ├── datatable/                  ← TanStack Table wrapper
│   │   └── DataTable.jsx           ← Reusable data table with pagination
│   │
│   ├── form/                       ← React Hook Form + Zod driven components
│   │   ├── Form.jsx                ← Form container with RHF context
│   │   └── FormField.jsx           ← Field renderer (switches on fieldtype)
│   │
│   ├── dynamic/                    ← Metadata-driven high-level components
│   │   ├── DynamicList.jsx         ← Metadata-driven list view
│   │   └── DynamicForm.jsx         ← Metadata-driven form view
│   │
│   └── ui/                         ← shadcn/ui base components (customized)
│       ├── Button.jsx
│       ├── Input.jsx
│       ├── Select.jsx
│       ├── Textarea.jsx
│       ├── Checkbox.jsx
│       ├── Badge.jsx
│       ├── Modal.jsx
│       ├── Toast.jsx
│       ├── Skeleton.jsx
│       ├── Dropdown.jsx
│       └── Pagination.jsx
│
├── hooks/                          ← Custom React hooks
│   ├── useDocType.js               ← Fetch + cache DocType metadata
│   ├── useList.js                  ← Paginated list data fetching
│   ├── useForm.js                  ← Form data loading and submission
│   ├── usePermissions.js           ← Current user permissions
│   ├── useAuth.js                  ← Auth state and token management
│   ├── useTranslation.js           ← i18n label translation
│   └── useTheme.js                 ← Active theme management
│
├── store/                          ← Zustand global state stores
│   ├── auth.store.js               ← User session, tokens, roles
│   ├── metadata.store.js           ← Cached DocType metadata
│   ├── ui.store.js                 ← Sidebar open/close, modal state
│   └── translation.store.js        ← Loaded translations per language
│
├── lib/                            ← Frontend utilities and API client
│   ├── api.client.js               ← Axios instance with interceptors
│   ├── auth.lib.js                 ← Token refresh logic
│   ├── translation.lib.js          ← i18n label lookup helper
│   └── date.lib.js                 ← Date formatting via dayjs
│
├── styles/
│   └── globals.css                 ← Tailwind CSS directives + custom globals
│
├── constants/
│   ├── routes.js                   ← Route path constants
│   ├── fieldtypes.js               ← DocField type definitions
│   ├── themes.js                   ← Theme name/config constants
│   └── api.js                      ← API endpoint constants
│
├── public/                         ← Static assets
│   ├── logo.svg
│   ├── favicon.ico
│   └── images/
│
├── .env.local.example
├── .eslintrc.js
├── tailwind.config.js              ← Design tokens + theme configuration
├── next.config.js
└── package.json
```

---

### Pages Router Route Map

> This table gives any developer an instant understanding of every screen in the app.

| URL Pattern | File | Description |
|-------------|------|-------------|
| `/login` | `pages/login.js` | Login screen |
| `/forgot-password` | `pages/forgot-password.js` | Password reset request |
| `/reset-password` | `pages/reset-password.js` | Password reset form |
| `/dashboard` | `pages/dashboard.js` | Home dashboard |
| `/module/[module]` | `pages/module/[module].js` | Module home (e.g., `/module/accounting`) |
| `/doctype/[doctype]` | `pages/doctype/[doctype].js` | Dynamic List view for any DocType |
| `/document/[doctype]/new` | `pages/document/[doctype]/[name].js` | Dynamic Form — create new record |
| `/document/[doctype]/[id]` | `pages/document/[doctype]/[name].js` | Dynamic Form — edit existing record |
| `/settings` | `pages/settings/index.js` | System settings home |
| `/settings/module` | `pages/settings/module.js` | Module management |
| `/settings/doctype` | `pages/settings/doctype.js` | DocType management |
| `/settings/role` | `pages/settings/role.js` | Role management |
| `/settings/user` | `pages/settings/user.js` | User management |
| `/profile` | `pages/profile.js` | User profile, theme, language |

---

### Plugins (`/plugins`)

```
plugins/
├── {plugin-name}/
│   ├── plugin.manifest.json        ← REQUIRED: Plugin declaration
│   ├── backend/
│   │   ├── routes/                 ← Plugin-specific routes
│   │   ├── services/               ← Plugin business logic
│   │   ├── repositories/           ← Plugin database access
│   │   ├── hooks/                  ← Event listeners
│   │   └── migrations/             ← Plugin database migrations
│   │
│   ├── frontend/
│   │   ├── components/             ← Plugin UI components
│   │   └── pages/                  ← Plugin page additions
│   │
│   └── README.md                   ← Plugin documentation
```

### Plugin Manifest (`plugin.manifest.json`)

```json
{
  "name": "plugin-name",
  "version": "1.0.0",
  "author": "Author Name",
  "description": "What this plugin does",
  "frameeVersion": ">=1.0.0",
  "dependencies": [],
  "provides": {
    "modules": ["ModuleName"],
    "doctypes": ["DocType1", "DocType2"]
  },
  "hooks": {
    "after_insert": ["DocType1"]
  }
}
```

---

### Shared (`/shared`)

```
shared/
├── constants/
│   ├── fieldtypes.js               ← DocField type enum
│   ├── events.js                   ← Event name constants
│   └── permissions.js              ← Permission action constants
│
├── i18n/
│   └── en.js                       ← Default English string keys
│
└── types/                          ← TypeScript types (optional)
    ├── doctype.types.ts
    ├── docfield.types.ts
    └── api.types.ts
```

---

## Future Improvements

- **CLI Scaffolding Tool** — `framee create:plugin`, `framee create:doctype` generate the correct folder structure.
- **Plugin Hot Reload** — Watch `/plugins/` and reload plugins without server restart in development.
- **Storybook Integration** — Visual component-driven development under `frontend/.storybook/`.
- **Workspace Packages** — npm workspaces for shared package resolution.

---

## Acceptance Criteria

- [ ] A developer can navigate to any file type by following this document alone, without asking questions.
- [ ] The Pages Router structure makes all available routes visible by listing the `pages/` directory.
- [ ] `pages/doctype/[doctype].js` renders the Dynamic List for any active DocType without code changes.
- [ ] `pages/document/[doctype]/[name].js` renders the Dynamic Form for both create (`name = new`) and edit (`name = {id}`) modes.
- [ ] `pages/profile.js` exposes theme and language preference settings.
- [ ] A new plugin created by following the plugin folder structure is loadable without core code changes.
- [ ] No `.env` files are committed (enforced by `.gitignore`).
- [ ] All engine files import only from `config/`, `utils/`, and `repositories/` — never from `routes/`.
- [ ] Migration files are sequentially numbered and pass the migration runner.

---

## Notes

- **Pages Router is Non-Negotiable** — The Pages Router is chosen for developer clarity. `pages/login.js` → `/login`. `pages/doctype/[doctype].js` → `/doctype/Customer`. No mental model required — the folder IS the documentation. App Router's complexity (Server Components, layouts, loading files) is avoided.
- **Colocation of Pages and Logic** — Data fetching logic for a page lives in `hooks/` or `lib/`, not inside the page file. Page files should be thin — render the layout, call the right component, pass the right props.
- **No Barrel Files** — Avoid `index.js` barrel re-exports. Import directly from the source file to prevent circular dependencies.
- **Plugin Migrations are Separate** — Plugin database migrations run via the Plugin Loader, not the core migration runner. They must follow the same column contract (id, tenant_id, etc.).
- **Translation store** — All labels in the UI (`label`, `labelModule`, `labelMenu`, `labelField`) must go through `useTranslation()`. The translation store loads the user's language translations from the `Translations` API on login.
