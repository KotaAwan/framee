# 03-01 NextJS Architecture

## Purpose

This document defines the **frontend architecture** of Framee, built on Next.js 15 using the **Pages Router**. It establishes the structure, patterns, and conventions that govern all frontend development — from page routing and state management to API communication, styling, and i18n.

The frontend's primary responsibility is to render dynamic, metadata-driven user interfaces by reading DocType schemas from the backend API and rendering forms, lists, and layouts accordingly. It contains no hard-coded field definitions or business logic — it is a pure rendering layer driven by metadata.

---

## Goals

1. Define a clear, consistent architecture for the Next.js 15 Pages Router frontend.
2. Establish patterns for metadata-driven rendering, API communication, and state management.
3. Ensure a familiar **AdminLTE-style** layout experience for business users.
4. Provide Mobile First, responsive design across all screen sizes.
5. Support a multi-theme system (Classic, Modern, Compact, Dark, Corporate).
6. Support multi-language (i18n) with per-user language preference.
7. Enable rapid addition of new DocType UIs — metadata handles rendering, no new code.

---

## Scope

### In Scope
- Next.js 15 Pages Router project structure and routing conventions
- Application shell layout (AdminLTE-inspired)
- Authentication flow (login, logout, token refresh via Axios interceptor)
- Global state management (Zustand)
- API client configuration (Axios with interceptors)
- Tailwind CSS design token and theme system
- Component library structure (layout, navigation, cards, datatable, form, dynamic, ui)
- Error handling and loading state conventions
- Internationalization (i18n) via `Translations` DocType
- Theme system (Classic, Modern, Compact, Dark, Corporate)
- Profile page with theme + language preference

### Out of Scope
- Domain-specific ERP page UIs (delivered by domain plugins)
- Mobile native apps (iOS/Android) — responsive web only
- Server-side rendering of ERP business data (client-side fetching for dynamic content)
- Build and deployment pipeline (covered in Development Constitution)

---

## Functional Requirements

### FR-001 Pages Router Conventions
- All pages live in `pages/` directory. Each file = one route.
- Authentication-protected pages use `getServerSideProps` or a client-side auth guard HOC.
- Public pages: `login.js`, `forgot-password.js`, `reset-password.js`.
- Authenticated pages: everything under `dashboard.js`, `module/`, `doctype/`, `document/`, `settings/`, `profile.js`.

### FR-002 Dynamic DocType Routing
- Dynamic List: `/doctype/[doctype]` → `pages/doctype/[doctype].js`
- Dynamic Form (create): `/document/[doctype]/new` → `pages/document/[doctype]/[name].js`
- Dynamic Form (edit): `/document/[doctype]/[id]` → `pages/document/[doctype]/[name].js`
- No code changes required to support a new DocType — the route already exists.

### FR-003 Authentication Guard
- A `withAuth` HOC wraps all authenticated pages.
- On mount, checks for a valid access token in Zustand auth store.
- If expired, attempts silent refresh via the Axios interceptor.
- On failure, redirects to `/login`.

### FR-004 Metadata Caching
- DocType metadata fetched from the API is cached in the Zustand `metadata.store.js`.
- Cached metadata is reused until the server signals a cache miss via `Cache-Control: no-cache`.

### FR-005 Responsive Design
- Mobile First: all layouts designed for 375px viewport as the baseline.
- Tailwind responsive prefixes (`sm:`, `md:`, `lg:`) add progressive desktop enhancements.
- Sidebar is hidden on mobile and toggled via a hamburger button.

### FR-006 Error Handling
- Unhandled render errors are caught by a React Error Boundary at the `_app.js` level.
- API errors are handled by the Axios response interceptor and surfaced as Toast notifications.
- Specific HTTP status codes map to specific behaviors (401 → logout, 403 → access denied page, 422 → form field errors, 429 → rate limit toast).

### FR-007 i18n (Internationalization)
- All user-visible labels must pass through `useTranslation()`.
- Default language: English. All keys are English strings.
- Per-user language preference is stored in `sys_user.language` and in Zustand.
- On login, the frontend fetches the user's language translations from `GET /api/v1/translations/{language}`.
- The `translation.store.js` holds the full key→value map for the active language.
- If a key has no translation, it falls back to the English default.

### FR-008 Theme System
- Active theme is stored in user preferences (`sys_user.theme`) and in `localStorage` as a fallback.
- Theme is applied by adding `data-theme="{themeName}"` to `<body>`.
- Tailwind CSS `data-theme` variant selectors override design tokens per theme.
- All components use Tailwind utility classes that respect the active theme's tokens.
- Theme switching takes effect immediately without page reload.

---

## Architecture

### Pages Router Route Map

```
pages/
├── _app.js                         ← Global: layout, auth guard, theme, Zustand
├── _document.js                    ← Custom HTML shell
├── index.js                        ← Redirect → /dashboard
│
├── login.js                        ← /login
├── forgot-password.js              ← /forgot-password
├── reset-password.js               ← /reset-password
│
├── dashboard.js                    ← /dashboard
│
├── module/
│   └── [module].js                 ← /module/:module (module home)
│
├── doctype/
│   └── [doctype].js                ← /doctype/:doctype (Dynamic List)
│
├── document/
│   └── [doctype]/
│       └── [name].js               ← /document/:doctype/new | /:id (Dynamic Form)
│
├── settings/
│   ├── index.js                    ← /settings
│   ├── module.js                   ← /settings/module
│   ├── doctype.js                  ← /settings/doctype
│   ├── role.js                     ← /settings/role
│   └── user.js                     ← /settings/user
│
└── profile.js                      ← /profile (theme + language)
```

### Data Flow

```
User navigates to /doctype/Customer
  │
  ▼
pages/doctype/[doctype].js
  │
  ├─► 1. withAuth HOC: check token → refresh → redirect if invalid
  │
  ├─► 2. AppLayout renders (Sidebar + Header + Breadcrumb + Toolbar)
  │
  ├─► 3. useDocType('Customer')
  │       → GET /api/v1/meta/doctype/Customer
  │       → Cache in Zustand metadata.store
  │
  ├─► 4. usePermissions('Customer', 'read')
  │       → from Zustand auth.store (permissions loaded at login)
  │       → If no read: redirect to /403
  │
  └─► 5. <DynamicList doctype="Customer" />
            → useList() → GET /api/v1/doc/Customer?page=1&pageSize=20
            → <DataTable /> renders records
```

### Component Hierarchy

```
_app.js (AuthProvider, ThemeProvider, Zustand, Axios interceptors)
  └── AppLayout
      ├── Sidebar
      │   └── MenuTree
      │       └── MenuItem (recursive)
      ├── Header (hamburger, breadcrumb, user avatar, theme toggle, language)
      ├── Breadcrumb
      ├── Toolbar (New button, filters shortcut, bulk actions)
      ├── Content
      │   └── DynamicList | DynamicForm | Dashboard widgets | ...
      └── Footer (optional)
```

---

## Database Design

_Not applicable. The frontend has no database._

---

## API Design

### API Client (`lib/api.client.js`)

Axios instance configured with:

- `baseURL`: `process.env.NEXT_PUBLIC_API_URL`
- **Request interceptor**: Attaches `Authorization: Bearer {accessToken}` from Zustand auth store.
- **Response interceptor**:

| HTTP Status | Behavior |
|-------------|---------|
| `401 TOKEN_EXPIRED` | Attempt silent token refresh → retry original request → on second 401: logout + redirect `/login` |
| `401 UNAUTHORIZED` | Logout + redirect `/login` |
| `403` | Show "Access Denied" Toast + stay on page |
| `404` | Show "Not Found" Toast |
| `422` | Parse `error.fields` → dispatch to form state via `useForm` |
| `429` | Show "Too many requests, retry in Xs" Toast |
| `500` | Show "Server error" Toast + log to console |
| Network error | Show "Network unavailable" Toast |

---

## UI Behaviour

### AdminLTE-Inspired Layout

```
┌────────────────────────────────────────────────────┐
│ Header                                             │
│ [☰] [Logo/App Name]          [🔔] [User Avatar ▾]  │
├──────────────┬─────────────────────────────────────┤
│              │ Breadcrumb                          │
│ Sidebar      │ Home > Accounting > Customer        │
│              ├─────────────────────────────────────┤
│ ▼ Accounting │ Toolbar                             │
│   Customer   │ [+ New]  [🔍 Search]  [⚙ Filter]   │
│   Invoice    ├─────────────────────────────────────┤
│   Payment    │                                     │
│              │ Content                             │
│ ▶ HR         │ <DynamicList /> or <DynamicForm />  │
│              │                                     │
│ ▶ Inventory  │                                     │
│              ├─────────────────────────────────────┤
│              │ Pagination                          │
│              │ Show [20 ▾]  Showing 1-20 of 145    │
│              │ Pages: ← 1  2  3 ... 8 →            │
└──────────────┴─────────────────────────────────────┘
```

### Sidebar Behavior
- **Desktop**: Fixed left, 260px wide. Tree menu with collapsible module sections.
- **Tablet (768px–1279px)**: Collapsed to 60px icon-only. Hover expands.
- **Mobile (< 768px)**: Off-screen. Toggled by hamburger button in Header. Opens as full-height overlay.
- Active menu item is highlighted with the theme's primary color.
- Collapsed state is persisted in `localStorage`.

### Header Content
- Left: Hamburger toggle button + App Logo/Name
- Center: (empty or global search on desktop)
- Right: Notification bell | User avatar + name | Logout dropdown

### Theme Toggle
- A theme selector appears in the Header (icon button) and in `/profile`.
- Options: Classic, Modern, Compact, Dark, Corporate.
- Selecting a theme applies immediately via `data-theme` on `<body>`.

### Language Selector
- A language selector appears in `/profile`.
- Options are fetched from `GET /api/v1/meta/languages` (available languages).
- Selecting a language fetches the translation map and updates `translation.store.js`.

### Pagination
- All list views use a standardized pagination bar below the content area.
- Page size selector: `[10 | 20 | 50 | 100 | 200]` — configurable per DocType.
- Display: `Show [20 ▾]  Showing 21–40 of 145 records  Pages: ← 1  2  3 ... 8 →`

---

## Configuration

| Config Key | File | Description |
|------------|------|-------------|
| `NEXT_PUBLIC_API_URL` | `.env.local` | Backend API base URL |
| `NEXT_PUBLIC_APP_NAME` | `.env.local` | Application display name |
| `NEXT_PUBLIC_DEFAULT_LANG` | `.env.local` | Default UI language (`en`) |
| `NEXT_PUBLIC_DEFAULT_THEME` | `.env.local` | Default theme (`classic`) |

### `tailwind.config.js` — Theme Token Structure

```js
module.exports = {
  content: ['./pages/**/*.{js,jsx}', './components/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Overridden per data-theme via CSS variables
        primary:    'var(--color-primary)',
        sidebar:    'var(--color-sidebar)',
        'sidebar-text': 'var(--color-sidebar-text)',
        surface:    'var(--color-surface)',
        border:     'var(--color-border)',
        muted:      'var(--color-muted)',
      },
    },
  },
}
```

### `styles/globals.css` — Theme Definitions

```css
/* Classic (AdminLTE-inspired) */
[data-theme="classic"] {
  --color-primary:       #3c8dbc;
  --color-sidebar:       #222d32;
  --color-sidebar-text:  #8aa4af;
  --color-surface:       #ffffff;
  --color-border:        #d2d6de;
  --color-muted:         #6c757d;
}

/* Dark */
[data-theme="dark"] {
  --color-primary:       #4F46E5;
  --color-sidebar:       #0f172a;
  --color-sidebar-text:  #94a3b8;
  --color-surface:       #1e293b;
  --color-border:        #334155;
  --color-muted:         #64748b;
}

/* Modern */
[data-theme="modern"] {
  --color-primary:       #6366f1;
  --color-sidebar:       #f8fafc;
  --color-sidebar-text:  #475569;
  --color-surface:       #ffffff;
  --color-border:        #e2e8f0;
  --color-muted:         #94a3b8;
}

/* Compact (same as classic, tighter spacing via Tailwind scale) */
/* Corporate */
```

---

## Validation Rules

- No form field definitions or column definitions are hard-coded in any page component.
- All user-visible text must pass through `useTranslation()` — even for initial English-only releases.
- No business logic in page components — only rendering and user interaction.
- API errors must be caught by the Axios interceptor — uncaught promise rejections are forbidden.
- Tailwind utility classes only — no inline style attributes on any component.
- Theme colors must only reference CSS custom properties (`var(--color-*)`) — no hard-coded hex values in components.

---

## Security

- Access tokens stored in Zustand memory — NOT in `localStorage`.
- Refresh tokens stored in `httpOnly` cookies — inaccessible to JavaScript.
- All API calls include Authorization header automatically via Axios interceptor.
- `X-Frame-Options: DENY` and `X-Content-Type-Options: nosniff` set via `next.config.js`.
- No sensitive data logged to browser console in production (`NODE_ENV === 'production'`).
- User-entered content displayed in forms is escaped — no raw HTML rendering.

---

## Events

_The frontend communicates with the backend via REST API. Frontend-to-frontend state changes use Zustand store updates and React state._

---

## Performance

### Pages Router Code Splitting
- Next.js automatically code-splits per page file.
- Large components (rich text editor, charts) are dynamically imported with `next/dynamic` + `ssr: false`.

### Metadata Caching
- DocType metadata cached in Zustand — navigating between DocTypes of the same type skips the API call.
- Translation map loaded once at login, stored in Zustand for the session.

### TanStack Table
- Virtual row rendering enabled for large datasets (> 200 rows).
- Column definitions derived from metadata are memoized with `useMemo`.

### Tailwind PurgeCSS
- In production, only used Tailwind utility classes are included in the CSS bundle.
- Estimated bundle impact: < 10KB of CSS.

### Image Optimization
- Next.js `<Image>` component for all images (WebP conversion, lazy loading).

---

## Future Improvements

- **Progressive Web App (PWA)** — Service worker for offline access and installability.
- **TypeScript** — Incremental TypeScript adoption.
- **Storybook** — Component-driven development and visual regression testing.
- **Plugin Page Extensions** — Plugins register custom pages at declared routes.
- **Real-Time Updates** — WebSocket push for live record changes.
- **Global Command Palette** — `Ctrl+K` search across DocTypes and records.
- **RTL Support** — Right-to-left layout for Arabic/Hebrew locales.

---

## Acceptance Criteria

- [ ] The app boots on Next.js 15 Pages Router without errors.
- [ ] Navigating to `/doctype/Customer` renders the Customer Dynamic List.
- [ ] Navigating to `/document/Customer/new` renders a blank Dynamic Form.
- [ ] Navigating to `/document/Customer/{id}` renders the form pre-filled with the record.
- [ ] Navigating without a valid token redirects to `/login`.
- [ ] After login, the sidebar renders all active modules and their DocType links.
- [ ] Switching theme from `classic` to `dark` applies instantly via `data-theme` on `<body>`.
- [ ] Changing language in `/profile` fetches the translation map and relabels all visible labels.
- [ ] A 401 response triggers silent refresh → retry → logout on second failure.
- [ ] A 422 response routes field errors to the correct form fields.
- [ ] Sidebar collapses to icon-only on tablet and hides on mobile.
- [ ] Pagination bar shows `Show [20 ▾]  Showing 1-20 of 145  Pages: ← 1 2 3 ... 8 →`.
- [ ] All labels in the sidebar, breadcrumb, toolbar, and form pass through `useTranslation()`.

---

## Notes

- **Pages Router is the final decision.** It was chosen because `pages/login.js` → `/login` and `pages/doctype/[doctype].js` → `/doctype/Customer` is immediately obvious to any developer — no framework knowledge required. App Router's Server Components, layouts, loading files, and route groups add cognitive overhead that is not justified for an admin ERP interface.
- **AdminLTE Experience + Tailwind** — The layout pattern (sidebar, header, breadcrumb, toolbar, content, pagination) is inspired by AdminLTE's proven ERP/admin UX. But the implementation uses Tailwind CSS and React components entirely — no AdminLTE CSS or Bootstrap dependency.
- **`_app.js` is the bootstrap point** — All global providers (Zustand, theme, i18n, Axios interceptors) are initialized in `_app.js`. Page components receive clean props and do not configure global concerns.
- **i18n is metadata-driven** — Translations are stored in the `Translations` DocType (key-value records). Adding a new language requires no frontend code — just adding translation records in the admin panel.
