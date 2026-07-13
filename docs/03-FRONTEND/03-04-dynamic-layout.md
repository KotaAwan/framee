# 03-04 Dynamic Layout

## Purpose

The Dynamic Layout system defines **how Framee's UI pages are structurally organized**. It governs the application shell (sidebar, header, breadcrumb, toolbar, content, pagination, footer), the inner page layout (form sections, columns, tabs), and the design token system (Tailwind CSS configuration) used consistently across the entire application.

The layout is **inspired by AdminLTE** — a battle-tested ERP/admin interface pattern that business users recognize and feel comfortable with — and is built entirely with **Tailwind CSS** and React components. No AdminLTE CSS or Bootstrap dependency is used.

---

## Goals

1. Provide a consistent AdminLTE-inspired shell layout for the entire authenticated application.
2. Define clear, named layout regions: Sidebar, Header, Breadcrumb, Toolbar, Content, Pagination, Footer.
3. Establish a Tailwind CSS design token system with multi-theme support (Classic, Modern, Compact, Dark, Corporate).
4. Ensure all layouts are Mobile First and responsive across mobile (375px), tablet (768px), and desktop (1280px).
5. Support a tree-structured sidebar menu for ERP module navigation.
6. Provide reusable card, stat card, and data table card components for dashboard and list views.
7. Support i18n translation for all visible labels in the layout.

---

## Scope

### In Scope
- Application shell layout component (`AppLayout.jsx`)
- Sidebar with tree navigation (`Sidebar.jsx`, `MenuTree.jsx`, `MenuItem.jsx`)
- Header bar (`Header.jsx`) with hamburger, breadcrumb, user avatar, theme selector, language selector
- Breadcrumb navigation (`Breadcrumb.jsx`)
- Page-level action toolbar (`Toolbar.jsx`)
- Content area wrapper (`Content.jsx`)
- Optional footer (`Footer.jsx`)
- Form inner layout (sections, columns via Tailwind grid)
- Card components (`Card.jsx`, `StatCard.jsx`)
- Tailwind CSS design token system (CSS custom properties + theme config)
- Five themes: Classic, Modern, Compact, Dark, Corporate
- Responsive breakpoints (Mobile First)
- Profile page theme + language preference controls

### Out of Scope
- Dashboard widget grid configuration (future Dashboard module)
- Print / PDF layouts (future feature)
- Custom plugin page slots (future extension point)
- RTL layout (future enhancement)

---

## Functional Requirements

### FR-001 AppLayout
- `AppLayout.jsx` is the authenticated application shell.
- It wraps every authenticated page via `pages/_app.js`.
- Renders: `<Sidebar>` + right-side container (`<Header>`, `<Breadcrumb>`, `<Toolbar>`, `<Content>`, optional `<Footer>`).

### FR-002 Sidebar
- Left-aligned, fixed position, 260px wide on desktop.
- Contains: App logo/name at top, `<MenuTree>` (module + DocType links), user info at bottom.
- `<MenuTree>` renders a recursive tree where each module is a collapsible group containing DocType links.
- Collapsed state: 60px icon-only on tablet. Hidden (off-screen) on mobile.
- Active module group is auto-expanded. Active menu item is highlighted.
- Sidebar state (collapsed/expanded) persisted in `localStorage`.

### FR-003 MenuTree
- `MenuTree.jsx` fetches `GET /api/v1/meta/navigation` (on login, cached in Zustand).
- Renders an accordion-style tree: `[▼ Accounting] → Customer, Invoice, Payment`.
- `MenuItem.jsx` handles both parent (module group) and child (DocType link) items.
- Support for unlimited depth (parent → child → sub-child) via recursive rendering.
- Icons: Lucide icons configured per module/DocType in the navigation manifest.

### FR-004 Header
- Fixed top bar, 56px height, full-width of the right panel.
- Left: Hamburger toggle (Lucide `Menu` icon) — controls sidebar on mobile/tablet.
- Center: App name (on mobile only) or empty.
- Right:
  - 🔔 Notification bell (future)
  - 🎨 Theme selector (Lucide `Palette` icon → dropdown of 5 themes)
  - 🌐 Language selector (globe icon → dropdown of available languages)
  - 👤 User avatar + name → dropdown: Profile, Settings, Logout

### FR-005 Breadcrumb
- Located between Header and Toolbar.
- Format: `Home > {Module Label} > {DocType Label} > {Record Title}`.
- Each segment is a clickable `<Link>`.
- On mobile: show only the last 2 segments.

### FR-006 Toolbar
- Located between Breadcrumb and Content.
- Contains page-level actions: `[+ New]`, `[🔍 Search]`, `[▼ Filter]`, `[⚙ Columns]`, bulk actions.
- For form pages: `[💾 Save]`, `[✕ Cancel]`, `[🗑 Delete]`, `[✓ Submit]` (contextual by page and permissions).
- Actions are rendered by the page component — Toolbar is a flex container receiving `actions` as props or children.

### FR-007 Content
- Scrollable main content area.
- Top padding: 24px desktop, 16px mobile.
- Max width: 1200px, centered.
- Receives `<DynamicList />` or `<DynamicForm />` as children.

### FR-008 Pagination (List Pages)
- Rendered within `Content` at the bottom of the list card.
- Standard format:

```
┌──────────────────────────────────────────────────────────────┐
│ Show [20 ▾]   Showing 21–40 of 145 records   ← 1  2  3 ... 8 → │
└──────────────────────────────────────────────────────────────┘
```

- Page size: `[10 | 20 | 50 | 100 | 200]`.
- Record count: `Showing {from}–{to} of {total} records`.
- Navigation: Previous `←`, numbered pages (max 7 shown, with `...`), Next `→`.

### FR-009 Theme System
- Active theme applied via `data-theme="{name}"` on `<body>`.
- Tailwind CSS `data-theme` variant selectors override CSS custom properties per theme.
- All component Tailwind classes reference semantic color tokens (`bg-sidebar`, `text-primary`, etc.).
- Five themes: `classic`, `modern`, `compact`, `dark`, `corporate`.
- Theme preference stored in `sys_user.theme` (server) and `localStorage` (client-side fallback).
- Switching theme: instant, no page reload required.

### FR-010 i18n in Layout
- Module labels: `useTranslation(module.label)`
- Menu item labels: `useTranslation(menuItem.label)`
- Breadcrumb segments: `useTranslation(segment.label)`
- Toolbar button labels: `useTranslation('Save')`, `useTranslation('New')`, etc.
- Language preference stored in user profile and loaded at login.

---

## Architecture

### Layout Composition

```
_app.js
  └── ThemeProvider (sets data-theme on <body>)
      └── AuthProvider (Zustand auth state)
          └── TranslationProvider (Zustand translation store)
              └── {Component} (each page from pages/)
                    └── AppLayout (wraps all authenticated pages)
                        ├── Sidebar (fixed left)
                        │   ├── SidebarHeader (logo + app name)
                        │   ├── MenuTree
                        │   │   └── MenuItem (recursive)
                        │   └── SidebarFooter (user info)
                        │
                        └── main (right panel, flex-col)
                            ├── Header (fixed top)
                            ├── Breadcrumb
                            ├── Toolbar
                            ├── Content
                            │   └── {page children}
                            └── Footer (optional)
```

### Layout Shell (Visual)

```
┌────────────────────────────────────────────────────┐
│ Header                                             │
│ [☰] [Logo]                    [🎨] [🌐] [👤 ▾]   │
├──────────────┬─────────────────────────────────────┤
│              │ Breadcrumb                          │
│ Sidebar      │ Home > Accounting > Customer        │
│ ──────────── ├─────────────────────────────────────┤
│ ▼ Accounting │ Toolbar                             │
│   Customer   │ [+ New]  [🔍 Search]  [▼ Filter]   │
│   Invoice    ├─────────────────────────────────────┤
│   Payment    │                                     │
│              │ Content                             │
│ ▶ HR         │ <DynamicList /> or <DynamicForm />  │
│              │                                     │
│ ▶ Inventory  │                                     │
│              ├─────────────────────────────────────┤
│              │ Pagination                          │
│              │ Show [20▾]  1-20 of 145  ←1 2 3→   │
└──────────────┴─────────────────────────────────────┘
```

---

## Database Design

_Not applicable. Dynamic Layout is a frontend structural system. Design tokens are stored in `tailwind.config.js` and `globals.css`._

---

## API Design

### APIs Used by Layout Components

| API | Component | Purpose |
|-----|-----------|---------|
| `GET /api/v1/meta/navigation` | MenuTree | Module + DocType navigation tree |
| `GET /api/v1/auth/me` | Header | Display user name, avatar, theme, language |
| `GET /api/v1/translations/{lang}` | TranslationProvider | Load translation map at login |
| `GET /api/v1/meta/languages` | Language selector | Available language list |

---

## UI Behaviour

### Sidebar Responsive Behavior

| Viewport | Behavior |
|----------|---------|
| Desktop ≥ 1280px | Fixed, 260px, always visible |
| Tablet 768px–1279px | Collapsed to 60px icon-only; hover expands tooltip |
| Mobile < 768px | Off-screen (translateX(-100%)); toggled by hamburger; opens as overlay |

**Animation**: Sidebar slides in/out with a `transition-transform duration-200 ease-in-out` CSS class.

### MenuTree Behavior
- Module groups are `<button>` elements with a Lucide `ChevronDown`/`ChevronRight` icon.
- Clicking toggles the group open/closed.
- Active group (currently navigated module) is auto-opened.
- Active DocType link is highlighted with `bg-primary/10 text-primary font-semibold`.

### Theme Selector (Header)
- Clicking 🎨 opens a dropdown with 5 theme options (each showing a small color swatch).
- Selecting applies `data-theme` to `<body>` and saves to user preference via `PUT /api/v1/auth/me`.

### Language Selector (Profile Page)
- A dropdown of available languages (fetched from API).
- Selecting triggers `GET /api/v1/translations/{lang}` → stores map in Zustand → all `useTranslation()` calls re-render with new labels.
- Saves to user preference via `PUT /api/v1/auth/me`.

---

## Configuration

| Config | Default | Description |
|--------|---------|-------------|
| `SIDEBAR_WIDTH` | `260px` | Full sidebar width |
| `SIDEBAR_COLLAPSED_WIDTH` | `60px` | Icon-only sidebar width |
| `HEADER_HEIGHT` | `56px` | Fixed header height |
| `CONTENT_MAX_WIDTH` | `1200px` | Max width of page content |
| `CONTENT_PADDING_DESKTOP` | `24px` | Padding on desktop |
| `CONTENT_PADDING_MOBILE` | `16px` | Padding on mobile |
| `PAGINATION_SIZES` | `[10,20,50,100,200]` | Selectable page sizes |
| `DEFAULT_PAGE_SIZE` | `20` | Default pagination size |
| `DEFAULT_THEME` | `classic` | Theme applied on first load |
| `DEFAULT_LANGUAGE` | `en` | Default UI language |

---

## Design Token Reference

### Tailwind Config (`tailwind.config.js`)

```js
module.exports = {
  content: ['./pages/**/*.{js,jsx}', './components/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary:        'var(--color-primary)',
        'primary-dark': 'var(--color-primary-dark)',
        sidebar:        'var(--color-sidebar)',
        'sidebar-text': 'var(--color-sidebar-text)',
        'sidebar-hover':'var(--color-sidebar-hover)',
        surface:        'var(--color-surface)',
        border:         'var(--color-border)',
        muted:          'var(--color-muted)',
        'text-base':    'var(--color-text)',
      },
      spacing: {
        'sidebar':    'var(--sidebar-width)',
        'header':     'var(--header-height)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
      },
    },
  },
}
```

### Theme Definitions (`styles/globals.css`)

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* ── Classic (AdminLTE-inspired) ───────────────────────── */
[data-theme="classic"] {
  --color-primary:        #3c8dbc;
  --color-primary-dark:   #367fa9;
  --color-sidebar:        #222d32;
  --color-sidebar-text:   #8aa4af;
  --color-sidebar-hover:  #1e282c;
  --color-surface:        #f4f6f9;
  --color-border:         #d2d6de;
  --color-muted:          #6c757d;
  --color-text:           #333333;
  --sidebar-width:        260px;
  --header-height:        56px;
}

/* ── Dark ──────────────────────────────────────────────── */
[data-theme="dark"] {
  --color-primary:        #818cf8;
  --color-primary-dark:   #6366f1;
  --color-sidebar:        #0f172a;
  --color-sidebar-text:   #94a3b8;
  --color-sidebar-hover:  #1e293b;
  --color-surface:        #1e293b;
  --color-border:         #334155;
  --color-muted:          #64748b;
  --color-text:           #f1f5f9;
  --sidebar-width:        260px;
  --header-height:        56px;
}

/* ── Modern ────────────────────────────────────────────── */
[data-theme="modern"] {
  --color-primary:        #6366f1;
  --color-primary-dark:   #4f46e5;
  --color-sidebar:        #f8fafc;
  --color-sidebar-text:   #475569;
  --color-sidebar-hover:  #f1f5f9;
  --color-surface:        #ffffff;
  --color-border:         #e2e8f0;
  --color-muted:          #94a3b8;
  --color-text:           #1e293b;
  --sidebar-width:        260px;
  --header-height:        56px;
}

/* ── Compact ───────────────────────────────────────────── */
[data-theme="compact"] {
  /* Same palette as classic, smaller spacing */
  --color-primary:        #3c8dbc;
  --color-sidebar:        #222d32;
  --color-sidebar-text:   #8aa4af;
  --color-surface:        #f4f6f9;
  --color-border:         #d2d6de;
  --color-text:           #333333;
  --sidebar-width:        220px;
  --header-height:        44px;
}

/* ── Corporate ─────────────────────────────────────────── */
[data-theme="corporate"] {
  --color-primary:        #1d4ed8;
  --color-primary-dark:   #1e40af;
  --color-sidebar:        #1e3a5f;
  --color-sidebar-text:   #93c5fd;
  --color-sidebar-hover:  #1e3053;
  --color-surface:        #ffffff;
  --color-border:         #bfdbfe;
  --color-muted:          #6b7280;
  --color-text:           #111827;
  --sidebar-width:        260px;
  --header-height:        56px;
}
```

### Spacing & Typography Scale

```css
/* Applied globally in @layer base */
:root {
  --font-size-xs:    0.75rem;   /* 12px */
  --font-size-sm:    0.875rem;  /* 14px */
  --font-size-base:  1rem;      /* 16px */
  --font-size-lg:    1.125rem;  /* 18px */
  --font-size-xl:    1.25rem;   /* 20px */
  --font-size-2xl:   1.5rem;    /* 24px */
  --radius-sm:   4px;
  --radius-md:   6px;
  --radius-lg:   8px;
  --radius-xl:   12px;
}
```

---

## Validation Rules

- All components must use Tailwind utility classes — no inline style attributes.
- All colors in components must reference CSS custom property tokens (`text-primary`, `bg-sidebar`) — no hard-coded hex values.
- All user-visible text in layout components must pass through `useTranslation()`.
- Sidebar navigation only renders items for active modules and DocTypes the user has permission to view.
- `AppLayout.jsx` must only be used on authenticated pages. Public pages (`login.js`) render their own minimal layout.

---

## Security

- Navigation manifest is served from the server, pre-filtered by user permissions.
- The layout never renders user-supplied HTML (breadcrumb segment names are escaped).
- Theme preference is stored client-side in `localStorage` as a plain string — no executable content.
- User avatar URL is validated before rendering via Next.js `<Image>` domain whitelist.
- `X-Frame-Options: DENY` is set in `next.config.js` headers to prevent clickjacking.

---

## Events

### Frontend State Events
- `sidebar.toggled` — Sidebar open/close state changed (stored in Zustand `ui.store`).
- `theme.changed` — Active theme switched (updates `data-theme` on `<body>`).
- `language.changed` — User language changed (triggers translation map reload).

---

## Performance

### CSS Variables (Zero JS Re-renders for Theme)
- Theme switching is a CSS-only operation: `document.body.dataset.theme = newTheme`.
- No React state re-renders — all components update via CSS cascade.

### Navigation Caching
- Navigation manifest fetched once at login, cached in Zustand.
- Sidebar renders immediately from cached state — no loading state for navigation.

### Layout Stability
- All shell regions have fixed dimensions via CSS custom properties.
- `min-height: calc(100vh - var(--header-height))` on content area prevents layout shift.
- No Cumulative Layout Shift (CLS) from dynamic font loading — Inter is preloaded.

### Code Splitting
- `AppLayout` and all layout components are statically imported in `_app.js` — no dynamic imports for the shell.
- Plugin-contributed page content is dynamically imported per page.

---

## Component File Map

| Component | File | Description |
|-----------|------|-------------|
| `AppLayout` | `components/layout/AppLayout.jsx` | Main authenticated shell |
| `Sidebar` | `components/layout/Sidebar.jsx` | Left sidebar container |
| `Header` | `components/layout/Header.jsx` | Top header bar |
| `Breadcrumb` | `components/layout/Breadcrumb.jsx` | Breadcrumb trail |
| `Toolbar` | `components/layout/Toolbar.jsx` | Action bar below breadcrumb |
| `Content` | `components/layout/Content.jsx` | Scrollable content wrapper |
| `Footer` | `components/layout/Footer.jsx` | Optional footer |
| `MenuTree` | `components/navigation/MenuTree.jsx` | Recursive navigation tree |
| `MenuItem` | `components/navigation/MenuItem.jsx` | Single menu entry |
| `Card` | `components/cards/Card.jsx` | Generic content card |
| `StatCard` | `components/cards/StatCard.jsx` | KPI/stat dashboard card |
| `DataTable` | `components/datatable/DataTable.jsx` | TanStack Table wrapper |
| `Form` | `components/form/Form.jsx` | RHF form container |
| `FormField` | `components/form/FormField.jsx` | Metadata-driven field renderer |

---

## Future Improvements

- **Compact Layout Mode** — Tighter padding, smaller fonts, more data per screen.
- **Dashboard Widget Grid** — Configurable drag-and-drop dashboard with stat cards and charts.
- **Right Control Sidebar** — Optional right panel (similar to AdminLTE's control sidebar) for quick settings.
- **RTL Layout Support** — Mirror sidebar to the right for Arabic/Hebrew locales.
- **Breadcrumb History** — "Back" button that returns to the previous filtered list state.
- **Global Command Palette** — `Ctrl+K` opens a command palette for navigation and record search.
- **Notifications Panel** — Dropdown notification list from the bell icon in the Header.
- **Theme Editor** — Visual theme customization where admins can modify token values per tenant.

---

## Acceptance Criteria

- [ ] `AppLayout` renders Sidebar + Header + Breadcrumb + Toolbar + Content on every authenticated page.
- [ ] Sidebar shows correct module groups and DocType links from the navigation manifest.
- [ ] Sidebar collapses to icon-only at < 1280px and off-screen at < 768px.
- [ ] Hamburger button in Header toggles sidebar on mobile with a 200ms animation.
- [ ] Breadcrumb shows `Home > {Module} > {DocType} > {Record}` with clickable links.
- [ ] Toolbar renders correct action buttons per page context (List: [+ New, Filter] / Form: [Save, Cancel, Delete]).
- [ ] Theme selector in Header switches theme instantly via `data-theme` — no page reload.
- [ ] Classic theme: sidebar is dark (`#222d32`), primary is blue (`#3c8dbc`).
- [ ] Dark theme: sidebar is deep navy (`#0f172a`), surface is dark slate (`#1e293b`).
- [ ] Language selector (in profile) switches all layout labels (`useTranslation()`) to the selected language.
- [ ] Pagination bar shows `Show [20 ▾]  Showing 1–20 of 145  ← 1 2 3 ... 8 →`.
- [ ] Changing page size to 50 refetches with `pageSize=50` and updates the "Showing X–Y of Z" text.
- [ ] All layout labels (module names, menu items, toolbar buttons) pass through `useTranslation()`.
- [ ] No inline style attributes on any layout component — Tailwind classes only.
- [ ] No hard-coded hex color values in component JSX — all via CSS custom property tokens.

---

## Notes

- **AdminLTE Experience, Modern Stack** — The layout inspiration is AdminLTE, but nothing from AdminLTE is imported. The look is implemented purely with Tailwind CSS custom properties and utility classes. This gives us full control over the theme system and eliminates any Bootstrap/jQuery dependency.
- **AppLayout is thin** — It provides structure only. It does not fetch data, manage form state, or contain business logic. All it does is position the `Sidebar`, `Header`, `Breadcrumb`, `Toolbar`, `Content`, and `Footer` elements.
- **Token-first design** — Every color and spacing value that varies per theme must be expressed as a CSS custom property in `globals.css` and referenced via a Tailwind token in `tailwind.config.js`. Hard-coding a hex value in a component is a violation of the design system contract.
- **Profile page is the user control panel** — The `/profile` page is where users change their theme and language. These are the only two settings in the layout system that are user-controlled. Everything else is admin-configured.
- The Compact theme uses the same colors as Classic but smaller spacing (`--sidebar-width: 220px`, `--header-height: 44px`). This is enough for power users who want to see more content per screen.
