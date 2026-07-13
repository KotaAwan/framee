# 00-03 Technology Stack

## Purpose

This document defines the **official technology stack** for Framee — the Metadata Driven ERP Framework. It establishes which technologies are selected, why they were chosen, how they interact, and the constraints that govern their usage.

Every engineering decision that involves technology selection must be traced back to this document. This document serves as the authoritative reference for onboarding developers, AI agents, plugin authors, and technical reviewers who need to understand the system's technical foundation.

---

## Goals

1. Define the canonical set of technologies used across backend, frontend, database, cache, and infrastructure layers.
2. Explain the rationale for each technology choice.
3. Define version constraints and upgrade policies.
4. Describe how technologies interact across system layers.
5. Provide guardrails to prevent technology sprawl and dependency bloat.

---

## Scope

### In Scope
- Backend framework and runtime
- Frontend framework and UI tooling
- Primary database and query layer
- Caching layer
- API communication protocol
- Authentication mechanism
- Form management and validation
- Data table rendering
- Development and testing tooling

### Out of Scope
- Infrastructure and cloud platform selection (covered in Development Constitution)
- CI/CD pipeline tooling (covered in Development Constitution)
- Domain-specific libraries used by individual plugins (plugins manage their own dependencies)

---

## Functional Requirements

### FR-001 Stack Consistency
- All core framework components must use the defined technology stack exclusively.
- Introducing a new technology at the core layer requires a documented architectural decision record (ADR) and team approval.

### FR-002 Version Pinning
- All dependencies must be pinned to specific versions in `package.json` (backend and frontend).
- Unpinned floating version ranges (e.g., `*`, `latest`) are forbidden in production configurations.

### FR-003 Compatibility
- The backend and frontend must communicate exclusively through the defined REST API contract.
- No server-side rendering of business logic from the backend into the frontend.

---

## Architecture

### Layer Map

```
┌───────────────────────────────────────────────────────────────────┐
│  FRONTEND LAYER                                                    │
│  Next.js 15.x (Pages Router) │ React 19+ │ Tailwind CSS           │
│  shadcn/ui (customized) │ TanStack Table │ React Hook Form + Zod   │
│  Zustand (state) │ Axios (HTTP) │ Lucide (icons) │ Recharts        │
└───────────────────────────────┬───────────────────────────────────┘
                                │ HTTPS REST API (JSON)
┌───────────────────────────────▼───────────────────────────────────┐
│  BACKEND LAYER                                                     │
│  Node.js 22 LTS │ Express.js 5.x │ JWT Auth                       │
│  Plugin Loader │ Event Bus │ Metadata Engine                       │
└───────────────────────────────┬───────────────────────────────────┘
                                │
         ┌──────────────────────┼────────────────────┐
         │                      │                    │
┌────────▼───────┐   ┌──────────▼──────┐   ┌────────▼────────┐
│  MySQL 8.x      │   │  Redis 8.x       │   │  File Storage   │
│  Primary DB     │   │  Cache / Session │   │  (Local / S3)   │
└────────────────┘   └─────────────────┘   └─────────────────┘
```

---

## Database Design

_Not directly applicable. Stack definitions are not stored as database records._

---

## API Design

_Not directly applicable. API design standards are defined in the API Engine PRD (01-04)._

---

## UI Behaviour

_Not directly applicable. UI behavior is defined in the Frontend PRDs (03-01 through 03-04)._

---

## Configuration

### Backend Stack Configuration

| Config Key | Value | Description |
|------------|-------|-------------|
| `NODE_VERSION` | `22.x LTS` | Required Node.js runtime version |
| `EXPRESS_VERSION` | `^5.x` | Express.js version |
| `PORT` | `3001` | Default backend API port |
| `API_BASE_PATH` | `/api/v1` | Base URL prefix for all REST endpoints |
| `JWT_SECRET` | _environment variable_ | Secret key for JWT signing |
| `JWT_EXPIRES_IN` | `15m` | Access token expiry |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Refresh token expiry |

### Database Configuration

| Config Key | Value | Description |
|------------|-------|-------------|
| `DB_HOST` | `localhost` | MySQL host |
| `DB_PORT` | `3306` | MySQL port |
| `DB_NAME` | `framee` | Default database name |
| `DB_POOL_MIN` | `2` | Minimum connection pool size |
| `DB_POOL_MAX` | `20` | Maximum connection pool size |
| `DB_CHARSET` | `utf8mb4` | Character set |
| `DB_COLLATION` | `utf8mb4_unicode_ci` | Collation |

### Cache Configuration

| Config Key | Value | Description |
|------------|-------|-------------|
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_DB` | `0` | Redis database index |
| `CACHE_PREFIX` | `framee:` | Key prefix for all Framee cache entries |
| `METADATA_TTL` | `3600` | Metadata cache TTL (seconds) |

### Frontend Configuration

| Config Key | Value | Description |
|------------|-------|-------------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` | Backend API base URL |
| `NEXT_PUBLIC_APP_NAME` | `Framee` | Application display name |
| `NEXT_VERSION` | `15.x` | Required Next.js version |

---

## Validation Rules

- Node.js version must be `22.x LTS` or higher.
- MySQL version must be `8.0` or higher (JSON column support required).
- Redis version must be `8.0` or higher.
- Next.js must use the **Pages Router** pattern. App Router is not used in this framework.
- All database connections must use `utf8mb4` charset.
- Tailwind CSS must be configured via `tailwind.config.js` with the project's design token system.

---

## Security

### Runtime Security
- Express.js must run behind a reverse proxy (Nginx) in production.
- Helmet.js must be installed and configured for all Express instances.
- CORS policy must be explicitly configured. Wildcard `*` CORS origins are forbidden in production.

### Database Security
- Database credentials must be stored in environment variables, never in source code.
- MySQL must not be exposed on a public network interface.

### JWT Security
- JWT secrets must be at least 256 bits (32 bytes) in length.
- Access tokens must have a maximum 15-minute expiry.
- Refresh tokens must be stored with a revocation mechanism (Redis-based blocklist).

### Frontend Security
- Access tokens are stored in Zustand state (in-memory), not `localStorage`.
- Refresh tokens are stored in `httpOnly` cookies.
- All API calls from the frontend must include the Authorization header via Axios interceptor.

---

## Events

_Technology stack changes do not emit runtime events._

---

## Performance

### Backend Performance
- Express 5.x async/await error handling is used natively.
- Heavy computation must be offloaded to background workers.
- Response compression middleware must be enabled.

### Database Performance
- Connection pooling via `mysql2` + `knex.js` is mandatory.
- Large batch operations must use transactions with explicit commit/rollback.

### Cache Performance
- Redis 8.x is the performance layer. MySQL is the source of truth.
- Cache keys must be namespaced by `tenant_id`.

### Frontend Performance
- Next.js Pages Router with static optimization where applicable.
- Tailwind CSS uses PurgeCSS in production — only used classes are included in the bundle.
- TanStack Table uses virtual rendering for large datasets (configurable).
- React Hook Form minimizes re-renders during form interaction.

---

## Technology Reference

### Backend

| Technology | Version | Role |
|------------|---------|------|
| Node.js | 22.x LTS | JavaScript runtime |
| Express.js | ^5.x | HTTP server framework |
| mysql2 | ^3.x | MySQL client |
| knex.js | ^3.x | Query builder (no ORM) |
| ioredis | ^5.x | Redis client |
| jsonwebtoken | ^9.x | JWT signing and verification |
| bcryptjs | ^2.x | Password hashing |
| helmet | ^8.x | HTTP security headers |
| express-rate-limit | ^7.x | API rate limiting |
| zod | ^3.x | Input validation schema |
| winston | ^3.x | Structured logging |
| dotenv | ^16.x | Environment variable loading |

### Frontend

| Technology | Version | Role |
|------------|---------|------|
| Next.js | 15.x | React framework (Pages Router) |
| React | 19.x | UI library |
| Tailwind CSS | ^4.x | Utility-first CSS framework |
| shadcn/ui | latest | Accessible UI component primitives (customized) |
| Zustand | ^5.x | Global client-side state management |
| Axios | ^1.x | HTTP client with interceptors |
| React Hook Form | ^7.x | Performant form state management |
| Zod | ^3.x | Schema validation (frontend + backend shared) |
| TanStack Table | ^8.x | Headless data table with virtual rendering |
| Lucide React | ^0.4x | Consistent icon library |
| Recharts | ^2.x | Composable chart library |
| dayjs | ^1.x | Lightweight date/time manipulation |

### Database & Cache

| Technology | Version | Role |
|------------|---------|------|
| MySQL | 8.x | Primary relational database |
| Redis | 8.x | Cache, session store, rate limit counter |

### Development Tooling

| Technology | Version | Role |
|------------|---------|------|
| ESLint | ^9.x | JavaScript/JSX linting |
| Prettier | ^3.x | Code formatting |
| Jest | ^29.x | Unit and integration testing |
| Supertest | ^6.x | HTTP API testing |
| Nodemon | ^3.x | Backend dev hot reload |

---

## UI Philosophy

### AdminLTE-Inspired Layout + Tailwind CSS

The frontend follows the **AdminLTE experience** — a familiar, business-proven admin interface pattern — rebuilt entirely with Tailwind CSS and modern React components.

**Why AdminLTE-inspired?**
- Sidebar navigation with tree menus is immediately familiar to ERP users.
- Breadcrumb, header, toolbar, content, and pagination regions are clearly defined.
- Business users don't need to learn a new UI paradigm — the layout matches their expectations.

**Why Tailwind CSS?**
- Utility-first approach is highly compatible with metadata-driven component rendering.
- PurgeCSS ensures zero dead CSS in production bundles.
- Design tokens are managed via `tailwind.config.js` — changing a theme is a config change, not a CSS rewrite.
- AI code generation tools produce Tailwind code with high accuracy.

### Theme System

All components use Tailwind CSS design tokens. Multiple themes are supported by swapping the token values:

| Theme | Description |
|-------|-------------|
| `classic` | AdminLTE-inspired: navy sidebar, white content, traditional ERP feel |
| `modern` | Clean, minimal, open spacing, soft colors |
| `compact` | Dense layout, smaller fonts, suitable for data-heavy screens |
| `dark` | Full dark theme for low-light environments |
| `corporate` | Formal, blue-grey palette for enterprise presentations |

Theme selection is stored in user preferences and applied at the layout level via a Tailwind `data-theme` class on `<body>`.

### i18n (Internationalization)

- Semua label UI (`label`, `labelModule`, `labelMenu`, `labelField`) akan dilewatkan pada fungsi terjemahan i18n.
- Default language: English.
- **Penyimpanan Label**: Semua label dan terjemahan disimpan secara fisik di dalam *database* pada tabel (DocType) khusus:
  - **`languages`**: Menyimpan daftar bahasa yang didukung oleh sistem (misalnya: English, Bahasa Indonesia, dll).
  - **`translations`**: Menyimpan pasangan *key-value* dari teks asli ke bahasa tujuan.
- **Pemilihan Bahasa**: Pengguna (`User`) dapat membuka halaman **Profile** mereka dan memilih bahasa (`Language`) yang mereka inginkan dari daftar yang tersedia di tabel `languages`.
- **Dampak Tampilan**: Setelah pengguna memilih bahasa di *Profile*, maka seluruh tampilan antarmuka (*Frontend*) akan langsung memuat dan menggunakan *translation* yang sesuai dengan bahasa yang dipilih tersebut.

---

## shadcn/ui Policy

shadcn/ui is used as a **primitive layer** — accessible, composable, unstyled-base components that are then styled with Tailwind CSS to match the Framee design system. Components used include:

- `Button`, `Input`, `Select`, `Textarea`, `Checkbox`, `Switch`
- `Dialog` (Modal), `Sheet` (Sidebar drawer), `Dropdown Menu`
- `Toast` / `Sonner` (notifications)
- `Badge`, `Separator`, `Skeleton`
- `Tabs`, `Accordion`

Components are copied into `components/ui/` and customized — they are owned by the project, not imported from an external library at runtime.

---

## Future Improvements

- **TypeScript Migration** — Incremental TypeScript adoption starting with the Metadata Engine.
- **GraphQL Layer** — Additive GraphQL API alongside REST.
- **WebSocket Support** — Real-time updates via Socket.io.
- **PWA** — Service worker for offline access.
- **Automated API Documentation** — OpenAPI spec generated from DocType metadata.

---

## Acceptance Criteria

- [ ] Backend boots on Node.js 22 LTS with Express 5.x and serves `/api/v1/system/health` with `200 OK`.
- [ ] Frontend boots on Next.js 15 Pages Router without errors.
- [ ] MySQL 8.x connection is established and schema migrations run successfully.
- [ ] Redis 8.x connection is established and metadata cache stores/retrieves test keys.
- [ ] Tailwind CSS builds successfully with PurgeCSS in production mode.
- [ ] A Dynamic Form renders using React Hook Form with Zod validation.
- [ ] A Dynamic List renders using TanStack Table with pagination `<10, 20, 50, 100, 200>`.
- [ ] JWT tokens are issued at login and validated on all protected endpoints.
- [ ] Theme switching (classic → dark) changes the UI without page reload.
- [ ] A non-English label in a DocField is translated when the user's language is set.

---

## Notes

- **Pages Router is final** — The Pages Router is deliberately chosen over App Router for Framee. The reason is developer clarity: `pages/login.js`, `pages/[module]/[doctype].js` — any new developer immediately understands the routing without reading documentation. App Router's Server Components, parallel routes, and nested layouts add complexity that is not justified for a metadata-driven ERP admin interface.
- **No ORM** — Knex.js query builder only. This is intentional for metadata-driven column management.
- **Tailwind over Vanilla CSS** — Tailwind CSS provides the utility scale and token system needed for a multi-theme metadata-driven application. The design system is configured in `tailwind.config.js`, not in custom CSS variables.
- **shadcn/ui is a starting point, not a dependency** — Components are copied and owned by the project. This means no upstream breaking changes can affect the framework.
- This document must be reviewed and updated at the start of each major framework release cycle.
