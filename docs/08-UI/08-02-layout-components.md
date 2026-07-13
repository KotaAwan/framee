# 08-02 Layout Components

## Purpose

Documents the core layout structures used to wrap pages in Framee. The layout ensures a consistent navigation experience (Sidebar + Navbar) across all modules.

---

## 1. AppShell

The `AppShell` is the highest-level layout component wrapping all authenticated pages.

**Structure**:
```
┌────────────────────────────────────────────────────────┐
│  Navbar (Top) - Search, Tenant Switcher, Profile, Notif│
├────────────┬───────────────────────────────────────────┤
│            │                                           │
│  Sidebar   │  Page Content (Scrollable Area)           │
│  (Left)    │  - Page Header (Title, Actions)           │
│  - Modules │  - Main Content (Form/List/Dashboard)     │
│  - Links   │                                           │
│            │                                           │
└────────────┴───────────────────────────────────────────┘
```

**Implementation rules**:
- **Mobile Responsive**: Sidebar must be collapsible behind a hamburger menu on small screens (`lg:hidden`).
- **State**: The `isSidebarOpen` state is managed globally via Zustand so the Navbar toggle button can control the Sidebar.

---

## 2. Sidebar (Navigation)

The Sidebar renders navigation links based on the user's allowed modules and DocTypes.

### Data Source
The Sidebar structure is built dynamically by calling `GET /api/v1/meta/modules` and `GET /api/v1/meta/doctypes`.

### Features
1. **Module Switcher**: A dropdown at the top of the sidebar or an icon bar to switch between major ERP modules (e.g., HR, CRM, Accounting).
2. **Grouped Links**: DocTypes are grouped by their categories (e.g., "Master Data", "Transactions", "Reports").
3. **Active State**: The currently active route must be highlighted visually.

---

## 3. Navbar (Top Bar)

The Navbar provides global actions that are accessible from anywhere.

### Key Elements
1. **Global Search (Command Palette)**: Pressing `Ctrl+K` or `Cmd+K` opens a unified search modal to find documents, DocTypes, or settings.
2. **Tenant Switcher**: If the user belongs to multiple tenants, a dropdown to switch context.
3. **Notifications**: A bell icon showing unread alerts (connected to WebSocket or polling).
4. **User Menu**: Profile picture with a dropdown for "My Profile", "Preferences" (Theme/Language), and "Logout".

---

## 4. Page Header

Every page content area starts with a standard `PageHeader` component.

### Props
- `title` (string): e.g., "Sales Invoice" or "New Customer"
- `breadcrumbs` (array): `[{ label: 'Home', href: '/' }, { label: 'CRM', href: '/module/crm' }]`
- `status` (object): Rendered as a Badge if viewing a document (e.g., Draft, Submitted).
- `actions` (ReactNode): Buttons aligned to the right (e.g., "Save", "Submit", "New").

### Example Usage
```jsx
<PageHeader 
  title="CUST-0001" 
  status={{ label: "Active", variant: "success" }}
  actions={
    <div className="flex gap-2">
      <Button variant="secondary" onClick={handleCancel}>Cancel</Button>
      <Button variant="primary" onClick={handleSave}>Save</Button>
    </div>
  }
/>
```

---

## 5. View Layouts

Framee primarily uses two standard layouts for data:

### List View Layout (`pages/doctype/[doctype].js`)
- Full width.
- Filter bar below the Page Header.
- Data Table taking up the remaining vertical space with sticky headers.

### Form View Layout (`pages/document/[doctype]/[id].js`)
- Typically constrained to a max-width (e.g., `max-w-5xl`) centered on the screen for readability, unless the form is extremely wide (like a large grid).
- Card-based sections.
- Activity Timeline (Logs and Comments) appears either at the bottom of the form or in a collapsible right-side drawer.
