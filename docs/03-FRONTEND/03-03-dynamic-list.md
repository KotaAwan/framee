# 03-03 Dynamic List

## Purpose

The Dynamic List is Framee's **metadata-driven list view component**. Given a DocType name, it renders a paginated, filterable, sortable data table — automatically building its columns, filter options, and action buttons from the DocType's metadata, using **TanStack Table** as the headless engine and **Tailwind CSS** for all styling.

It is the first screen a user sees when navigating to a DocType. From here, users can search, filter, sort, view details in a modal, edit records, perform bulk actions, and view the DocType's local activity timeline — all without navigating away from the page.

---

## Goals

1. Render a fully functional data table for any DocType using only its metadata.
2. Use **TanStack Table v8** for sorting, pagination, and column management.
3. Provide **per-row action icons** (Lock, View, Edit, Like, Comment) consistent with the UI shown in the design reference.
4. Provide a **3-dot Vertical Menu (⋮)** in the toolbar for secondary operations (Import, Export, Fields View, Filter Fields).
5. Provide **Bulk Actions** for multi-row operations (Delete, Print, Status transitions).
6. Show a **`<doctype>_logs` Activity Timeline** below the table for local activity tracking.
7. Respect field-level read permissions — hidden fields are never shown.
8. Translate all labels via `useTranslation()`.

---

## Scope

### In Scope
- Paginated record table with TanStack Table
- Columns from `in_list_view` DocField metadata
- Standard filter bar (from `in_standard_filter` fields) + Advanced filter panel
- Full-text search (debounced, 300ms)
- Column header sorting (asc/desc toggle)
- Row checkbox selection
- **Per-row action icons**: Lock/Unlock, Eye (View Modal), Edit, Like, Comment count
- **Per-row Print** (if DocType has `allow_print = true`)
- **Toolbar 3-dot menu (⋮)**: Import CSV, Export XLSX, Export PDF, Fields View, Filter Fields
- **Bulk Actions bar**: Delete Selected, Print Selected, Status Actions (Submit / Lock / Unlock / etc.)
- **Activity Timeline section** below the table (data from `<doctype>_logs`)
- **View Modal** (`modalView`): Form Card + Like/Comment summary + Activity Timeline
- Column visibility toggle (per user, persisted in localStorage)
- Pagination bar `[10|20|50|100|200]`
- Empty state, loading skeleton
- Mobile card view (< 768px)
- i18n translations

### Out of Scope
- Pivot tables / aggregations (future Report Engine)
- Kanban / Calendar view (future)
- Inline row editing (future)
- Real-time updates (future WebSocket)

---

## Functional Requirements

### FR-001 TanStack Table Setup
- `DataTable.jsx` wraps TanStack Table's `useReactTable` hook.
- Column definitions are generated from DocField metadata (memoized with `useMemo`).
- Pagination is server-side: TanStack in manual pagination mode.
- Sorting is server-side: sort state sent as `?sort=field:asc`.

### FR-002 Column Generation from Metadata
- Fields with `in_list_view = 1` become columns in `sort_order` sequence.
- The `title_field` is always the first clickable column.
- Column header = `useTranslation(field.label)`.
- Columns not readable by the current user are excluded.

### FR-003 Field Value Rendering by Type

| DocField Type | Display |
|---------------|---------|
| Data / Text | Plain text (truncated 80 chars, ellipsis tooltip) |
| Int | Right-aligned number |
| Float | Right-aligned, 2 decimal places |
| Currency | Right-aligned with currency symbol (`IDR 1,250,000`) |
| Date | Locale-formatted (`13 Jul 2026`) |
| Datetime | Date + time |
| Check | ✓ green / ✗ red (Lucide icons) |
| Select | `<Badge>` with option text |
| Link | Clickable text → linked record form |
| Attach | Lucide `Paperclip` + filename |
| Attach Image | Thumbnail 32px height |

### FR-004 Standard Filters
- Fields with `in_standard_filter = 1` appear as quick filter inputs in the Toolbar.
- Renders by fieldtype: text input / dropdown / autocomplete / date range / number range / toggle.
- Active filters shown as dismissible `<Badge>` chips above the table.
- Filters reflected in URL query params for shareable links.

### FR-005 Advanced Filters
- Collapsible panel: `[Field ▾]  [Operator ▾]  [Value]  [✕]`
- Operators by type: equals, not equals, contains, starts with, is empty, is not empty, greater than, less than.
- Multiple rows = AND logic. Apply button triggers refetch.

### FR-006 Sorting
- Column header click: asc → desc → none.
- Lucide `ArrowUp` / `ArrowDown` icon shows active sort.
- URL param: `?sort=field_name:asc`.

### FR-007 Text Search
- Toolbar search bar. Debounced 300ms. URL param: `?search=query`.
- Searches against the DocType's `search_fields`.

### FR-008 Pagination Bar

```
┌────────────────────────────────────────────────────────────────┐
│  Show [20 ▾]   Showing 21–40 of 145 records   ← 1  2  3 ... 8 →  │
└────────────────────────────────────────────────────────────────┘
```

- Page size dropdown: `[10 | 20 | 50 | 100 | 200]`. Default: 20.
- Record count text: `Showing {from}–{to} of {total} records`.
- Page navigator: Previous, numbered pages (max 7 + ellipsis), Next.
- All state reflected in URL: `?page=2&pageSize=20`.

---

### FR-009 Per-Row Action Icons

Each row in the ACTION column shows the following icons (visibility gated by permission and DocType config):

```
ACTION column per row:
[🔒 Lock]  [👁 View]  [✏ Edit]  [❤ 0]  [💬 0]
```

| Icon | Component | Condition | Behavior |
|------|-----------|-----------|----------|
| 🔒 Lock (green) | `LockIcon` (Lucide) | status = Locked | Indicates locked; triggers Unlock if permitted |
| 🔓 Unlock (red) | `UnlockIcon` (Lucide) | status ≠ Locked | Triggers Lock action if permitted |
| 👁 Eye | `EyeIcon` (Lucide) | Always visible | Opens `modalView` for this record |
| ✏ Edit | `EditIcon` (Lucide) | `can_write = true` AND status allows edit | Navigates to `pageEdit` |
| 🗑 Trash | `Trash2Icon` (Lucide) | `can_delete = true` | Delete with confirmation |
| ❤ N | `HeartIcon` (Lucide) | Always | Shows Like count. Click = toggle Like |
| 💬 N | `MessageSquareIcon` (Lucide) | Always | Shows Comment count. Click = opens `modalView` scrolled to comment input |
| 🖨 Print | `PrinterIcon` (Lucide) | `allow_print = true` on DocType | Opens print preview for this record |

> **Rules:**
> - Lock/Unlock icons are toggled by calling `POST /api/v1/doc/{DocType}/{id}/lock` or `unlock`.
> - Like and Comment counts are read from `<doctype>_logs` aggregate query.
> - Edit button is hidden (not just disabled) when `can_write = false`.
> - All icons use Lucide with Tailwind color classes (`text-green-600`, `text-red-500`, `text-pink-500`, etc.).

---

### FR-010 Toolbar 3-Dot Vertical Menu (⋮)

The ⋮ button appears in the top-right toolbar (next to `[+ New]`). Clicking opens a dropdown menu:

```
┌─────────────────────────────┐
│ ⬆ Import CSV               │
│ ⬇ Export XLSX               │
│ ⬇ Export PDF                │
│ ─────────────────────────── │
│ 📋 Fields View              │
│ 🔍 Filter Fields            │
└─────────────────────────────┘
```

| Menu Item | Description |
|-----------|-------------|
| **Import CSV** | Opens file picker → uploads CSV → shows import preview modal → executes bulk insert |
| **Export XLSX** | Exports current filtered/sorted list to `.xlsx` (respects active filters) |
| **Export PDF** | Exports current list to PDF (respects active filters) |
| **Fields View** | Opens a modal: checkboxes for all DocFields → user selects which to show in the list → applies immediately (similar to Column Visibility but as a modal with field descriptions) |
| **Filter Fields** | Opens a modal: select fields to use as quick filters → adds them dynamically to the filter bar |

> **Permissions:** Import requires `can_import = 1`, Export requires `can_export = 1`. Items are hidden if user lacks permission.

---

### FR-011 Bulk Actions Bar

When ≥ 1 row is selected, a **Bulk Action Bar** appears above the table:

```
┌────────────────────────────────────────────────────────────────────────────┐
│  5 selected  [🗑 Delete]  [🖨 Print]  [⚡ Actions ▾]  [✕ Clear Selection]  │
└────────────────────────────────────────────────────────────────────────────┘
```

| Bulk Action | Condition | Behavior |
|-------------|-----------|----------|
| **Delete** | `can_delete = true` | Confirmation modal → `DELETE` all selected records |
| **Print** | `allow_print = true` on DocType | Batch print all selected records |
| **Actions ▾** | DocType has lifecycle actions | Dropdown of available status transitions for selected records: Submit, Lock, Unlock, Archive, Cancel |

> **Status transitions in bulk:** Only the actions valid for ALL selected records' current statuses are shown. Mixed-status selections show only the common applicable actions.

---

### FR-012 View Modal (`modalView`)

Triggered by clicking the 👁 Eye icon on any row. The modal opens as a full-height right-side drawer or centered modal (configurable).

#### Layout:

```
┌──────────────────────────────────────────────────────────────────────┐
│ [DocType Name] — [Record Title]                          [✕ Close]   │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────── FORM CARD (Read-only) ────────────────────────────┐   │
│  │  (mirrors pageAdd form layout — all fields, read-only mode)   │   │
│  │  [Print]  button in top-right of card if allow_print = true   │   │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌──────────── ENGAGEMENT ROW ──────────────────────────────────┐    │
│  │  LEFT:  [💬 input: Tulis komentar...]  [Kirim ➤]             │    │
│  │  RIGHT: ❤ 12 Likes     💬 5 Comments                         │    │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌──────────── ACTIVITY TIMELINE ───────────────────────────────┐    │
│  │  ⚡ Activity Timeline                                         │    │
│  │  ● Sutikno Sofjan — Created           Jul 12, 2026, 05:27    │    │
│  │  ● Sutikno Sofjan — Updated (name)    Jul 12, 2026, 05:52    │    │
│  │  ● Sutikno Sofjan — Locked            Jul 12, 2026, 06:21    │    │
│  │  ● Budi — Commented: "Sudah dicek"    Jul 12, 2026, 08:00    │    │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

**Rules:**
- Form Card is rendered in **read-only** mode (same layout as `pageAdd` but all inputs are disabled/display-only).
- Like button in the modal toggles the current user's like on this record.
- Comment input (`<textarea>`) + `[Kirim]` button → `POST /api/v1/doc/{DocType}/{id}/comment`.
- Activity Timeline is loaded from `GET /api/v1/logs/{doctype}/{id}` (data from `<doctype>_logs` table).
- Timeline shows: action badge, user avatar + name, timestamp, summary. Reverse chronological.
- Comments appear in the timeline alongside system events.

---

### FR-013 Activity Timeline Section (Below Table)

The pageIndex (list page) shows the **Activity Timeline** section below the pagination bar. This is the **DocType-level** local log:

```
┌──────────────────────────────────────────────────────────────────────┐
│ ⚡ Activity Timeline                                                  │
├──────────────────────────────────────────────────────────────────────┤
│  [S]  Sutikno Sofjan, ID 204 (Translation)  Deleted     Jul 12 05:52 │
│  [S]  Sutikno Sofjan, ID 313 (Translate)    Created     Jul 12 05:27 │
│  [S]  Sutikno Sofjan, ID 204 (Translation)  Unlocked    Jul 12 05:21 │
│  [S]  Sutikno Sofjan, ID 312 (Translate)    Created     Jul 12 05:02 │
│  [S]  Sutikno Sofjan, ID 203 (Language)     Locked      Jul 12 03:50 │
└──────────────────────────────────────────────────────────────────────┘
```

**Data source:** `GET /api/v1/logs/{doctype}?limit=20` — pulls from `<doctype>_logs` table.
- Default: shows latest 20 events across ALL records of this DocType.
- Paginated: `[Show more]` link at bottom.
- Each row: user avatar, user name, record ID + title, action badge (Created / Updated / Deleted / Locked / Unlocked / Commented / Liked), timestamp.
- Action badge uses color: green = Created, blue = Updated, red = Deleted, orange = Locked, teal = Unlocked, purple = Commented, pink = Liked.

---

## Architecture

```
pages/doctype/[doctype].js
  │
  ├── withAuth HOC
  ├── AppLayout (Sidebar, Header)
  │   └── Toolbar:
  │       [+ New]  [🔍 Search...]  [▼ Filter]  [⋮ Menu]
  │
  ├── DynamicList (components/dynamic/DynamicList.jsx)
  │   │
  │   ├── useDocType(doctype)           → metadata (columns, filters, permissions)
  │   ├── useList(doctype, params)      → paginated record data
  │   ├── usePermissions(doctype)       → per-action visibility
  │   │
  │   ├── StandardFilters (above table)
  │   ├── AdvancedFiltersPanel (collapsible)
  │   │
  │   ├── DataTable.jsx                 ← TanStack Table renderer
  │   │   ├── <thead> column headers with sort controls
  │   │   └── <tbody> rows
  │   │       ├── CheckboxCell
  │   │       ├── FieldCell (per column, renders by fieldtype)
  │   │       └── ActionCell
  │   │           ├── LockIcon / UnlockIcon
  │   │           ├── EyeIcon → opens ViewModal
  │   │           ├── EditIcon → navigates to pageEdit
  │   │           ├── TrashIcon (conditional)
  │   │           ├── PrintIcon (conditional)
  │   │           ├── HeartIcon + like count
  │   │           └── MessageSquareIcon + comment count
  │   │
  │   ├── BulkActionBar (shown when selection > 0)
  │   │   ├── DeleteSelected
  │   │   ├── PrintSelected
  │   │   └── StatusActionsDropdown
  │   │
  │   ├── Pagination bar
  │   │   ├── PageSizeSelector [10|20|50|100|200]
  │   │   ├── RecordCountText
  │   │   └── PageNavigator
  │   │
  │   └── ActivityTimeline (below pagination)
  │       └── useDocLogs(doctype)       → <doctype>_logs latest events
  │
  └── ViewModal (components/dynamic/ViewModal.jsx)
      ├── FormCard (read-only DynamicForm)
      ├── EngagementRow
      │   ├── CommentInput + SendButton
      │   └── LikeCount + CommentCount
      └── ActivityTimeline (doc-level)
          └── useDocLogs(doctype, docId) → <doctype>_logs for this record
```

---

## Database Design

### `<doctype>_logs` Table (Local Log — per DocType)

Each DocType that has `track_changes = true` gets its own local log table named `{dt_tablename}_logs`.

For example, DocType `Customer` → table `dt_customer_logs`.

| Column | Type | Description |
|--------|------|-------------|
| `id` | VARCHAR(36) | UUID PK |
| `tenant_id` | VARCHAR(36) | Tenant reference |
| `doctype` | VARCHAR(100) | DocType name |
| `doc_id` | VARCHAR(36) | FK → record in `dt_{doctype}` |
| `doc_name` | VARCHAR(255) | Human-readable record title at time of action |
| `action` | VARCHAR(30) | CREATE / UPDATE / DELETE / SUBMIT / CANCEL / LOCK / UNLOCK / COMMENT / LIKE / UNLIKE |
| `user_id` | VARCHAR(36) | FK → sys_user.id |
| `user_name` | VARCHAR(200) | Snapshot of user display name |
| `user_avatar` | VARCHAR(255) | Avatar URL at time of action |
| `comment` | TEXT | Comment text (for COMMENT actions only) |
| `diff` | JSON | Field-level before/after (for UPDATE only) |
| `change_summary` | TEXT | Human-readable single-line description |
| `created_at` | DATETIME | Immutable timestamp |

```sql
INDEX idx_doclogs_doc     (tenant_id, doc_id, created_at)
INDEX idx_doclogs_user    (tenant_id, user_id, created_at)
INDEX idx_doclogs_action  (tenant_id, action, created_at)
INDEX idx_doclogs_doctype (tenant_id, doctype, created_at)
```

> **Note:** `<doctype>_logs` stores lightweight activity for display. Detailed field diffs for audit purposes are stored in `sys_audit_log` (Global Log — see `01-10`).

### `<doctype>_likes` Table (Per DocType)

Stores per-user likes on each record.

| Column | Type | Description |
|--------|------|-------------|
| `id` | VARCHAR(36) | UUID PK |
| `tenant_id` | VARCHAR(36) | Tenant reference |
| `doc_id` | VARCHAR(36) | FK → `dt_{doctype}.id` |
| `user_id` | VARCHAR(36) | FK → `sys_user.id` |
| `created_at` | DATETIME | When liked |

```sql
UNIQUE INDEX idx_likes_unique (tenant_id, doc_id, user_id)
```

---

## API Design

### APIs Called by Dynamic List

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/meta/doctype/{name}` | Load DocType schema |
| `GET` | `/api/v1/doc/{DocType}` | Fetch paginated records |
| `DELETE` | `/api/v1/doc/{DocType}/{id}` | Delete single record (status = Deleted) |
| `POST` | `/api/v1/doc/{DocType}/{id}/lock` | Lock record |
| `POST` | `/api/v1/doc/{DocType}/{id}/unlock` | Unlock record |
| `POST` | `/api/v1/doc/{DocType}/{id}/submit` | Submit record |
| `POST` | `/api/v1/doc/{DocType}/{id}/like` | Toggle like |
| `POST` | `/api/v1/doc/{DocType}/{id}/comment` | Post a comment |
| `GET` | `/api/v1/logs/{doctype}` | DocType-level activity (latest N across all records) |
| `GET` | `/api/v1/logs/{doctype}/{id}` | Record-level activity timeline |
| `POST` | `/api/v1/doc/{DocType}/import` | Import CSV |
| `GET` | `/api/v1/doc/{DocType}/export?format=xlsx` | Export XLSX |
| `GET` | `/api/v1/doc/{DocType}/export?format=pdf` | Export PDF |
| `POST` | `/api/v1/doc/{DocType}/bulk-delete` | Bulk delete by IDs |
| `POST` | `/api/v1/doc/{DocType}/bulk-action` | Bulk status action |

### Query Parameters

```
GET /api/v1/doc/Customer
  ?page=1
  &pageSize=20
  &search=Maju
  &sort=customer_name:asc
  &filters[customer_type]=Company
  &fields=customer_name,customer_type,phone,created_at
```

---

## UI Behaviour

### Full Layout (Desktop)

```
┌─────────────────────────────────────────────────────────────────────┐
│ Breadcrumb: Home › System › Doctype                                 │
├─────────────────────────────────────────────────────────────────────┤
│ Toolbar:                                                            │
│ [Filter Name...]                             [⋮]  [+ New]          │
├─────────────────────────────────────────────────────────────────────┤
│  Active filters: [customer_type: Company ✕]                         │
├─────────────────────────────────────────────────────────────────────┤
│ ☐ │ NAME            │ ... │ ACTION                                  │
├───┼─────────────────┼─────┼─────────────────────────────────────────┤
│ ☐ │ Language        │     │ [🔒] [👁] [ ] [ ]   ❤ 0  💬 0          │
│ ☐ │ Menu            │     │ [🔒] [👁] [ ] [ ]   ❤ 0  💬 0          │
│ ☐ │ Module          │     │ [🔒] [👁] [✏] [🗑]  ❤ 0  💬 0          │
├─────────────────────────────────────────────────────────────────────┤
│  Show [10 ▾]   Showing 9 of 9 rows   Showing 1 of 1 pages  ← →    │
├─────────────────────────────────────────────────────────────────────┤
│ ⚡ Activity Timeline                                                │
│  [S] Sutikno Sofjan, ID 204 (Translation) Deleted   Jul 12 05:52   │
│  [S] Sutikno Sofjan, ID 313 (Translate)   Created   Jul 12 05:27   │
│  [S] Sutikno Sofjan, ID 204 (Translation) Unlocked  Jul 12 05:21   │
└─────────────────────────────────────────────────────────────────────┘
```

### 3-Dot Toolbar Menu (⋮) Dropdown

```
┌──────────────────────────┐
│ ⬆  Import CSV            │
│ ⬇  Export XLSX           │
│ ⬇  Export PDF            │
│ ─────────────────────── │
│ 📋  Fields View          │
│ 🔍  Filter Fields        │
└──────────────────────────┘
```

### Bulk Selection Mode

```
┌──────────────────────────────────────────────────────────────────────────┐
│  5 selected  [🗑 Delete]  [🖨 Print]  [⚡ Actions ▾]  [✕ Clear Selection] │
└──────────────────────────────────────────────────────────────────────────┘
```

### Mobile Card View (< 768px)

```
┌────────────────────────────────────┐
│ PT. Maju Jaya              Company │
│ 021-1234567         Jan 15, 2026   │
│ [🔒] [👁] [✏]    ❤ 0  💬 0        │
└────────────────────────────────────┘
```

### Empty State

```
┌────────────────────────────────────────┐
│                                        │
│     📋  No records found              │
│     Try clearing your filters or       │
│     create a new record.               │
│          [+ New]                       │
└────────────────────────────────────────┘
```

---

## Configuration

| Config | Default | Description |
|--------|---------|-------------|
| `LIST_DEFAULT_PAGE_SIZE` | `20` | Default records per page |
| `LIST_PAGE_SIZE_OPTIONS` | `[10, 20, 50, 100, 200]` | Selectable sizes |
| `LIST_SEARCH_DEBOUNCE_MS` | `300` | Search debounce |
| `LIST_MAX_CELL_TEXT_LENGTH` | `80` | Truncate long text |
| `LIST_ENABLE_VIRTUAL_ROWS` | `false` | TanStack virtual rows for > 200 rows |
| `LIST_ACTIVITY_LIMIT` | `20` | Activity Timeline rows shown by default |
| `LIST_ENABLE_LIKE` | `true` | Enable Like feature per row |
| `LIST_ENABLE_COMMENT` | `true` | Enable Comment feature per row |

---

## Validation Rules

- Filter values validated before query: date must be valid, numeric must be number, select must be from options.
- Bulk delete requires confirmation modal — no undo.
- Import CSV requires `can_import = 1`.
- Export requires `can_export = 1`.
- Delete action requires `can_delete = 1`.
- Like/Comment available to all authenticated users.
- Sort field must exist in DocType schema — arbitrary sort injection rejected.

---

## Security

- `?fields=` is auto-built from `in_list_view` fields only — no arbitrary field injection.
- Field visibility enforced server-side.
- Bulk delete validates `can_delete` per record before deletion.
- Export excludes hidden and non-readable fields.
- Import validates field types and required constraints before inserting.

---

## Events

### Frontend State Events
- `list.loaded` — Records fetched and rendered.
- `list.filter_changed` — Filters applied, new fetch triggered.
- `list.sort_changed` — Sort column changed.
- `list.page_changed` — Page or page size changed.
- `list.row_deleted` — Record deleted, list refreshed.
- `list.row_liked` — Like toggled, count refreshed.
- `list.comment_posted` — Comment posted, count and timeline refreshed.
- `list.status_changed` — Lock/unlock/submit triggered, row updated.

---

## Performance

- **Manual pagination**: only one page fetched at a time.
- **Sparse Field Loading**: `?fields=` populated with only `in_list_view` fields.
- **Debounced search**: 300ms.
- **Metadata caching**: DocType schema cached in Zustand.
- **Activity Timeline**: loaded lazily after main table renders (non-blocking).
- **Like/Comment counts**: fetched as aggregate from `<doctype>_logs`, cached per-row.

---

## Future Improvements

- **Kanban View** — Group by Select field.
- **Calendar View** — Date/Datetime records on calendar.
- **Inline Edit** — Edit cells directly in the row.
- **Saved Filters** — Named filter presets per user.
- **Multi-Sort** — Sort by multiple columns.
- **Column Drag-and-Drop Reorder**.
- **Real-time Activity** — WebSocket updates to Activity Timeline.

---

## Acceptance Criteria

- [ ] `/doctype/Customer` renders columns from `in_list_view` DocFields in `sort_order`.
- [ ] Records paginated, 20 per page default; page size selector works.
- [ ] Pagination bar shows `Showing {from}–{to} of {total} records`.
- [ ] Column header click sorts asc → desc → none with Lucide icon.
- [ ] Standard filter for Select field renders dropdown with options.
- [ ] Filter appends `?filters[...]` to URL and updates list.
- [ ] `[+ New]` navigates to `/document/{DocType}/new`.
- [ ] Row title click navigates to `/document/{DocType}/{id}`.
- [ ] 👁 Eye icon opens ViewModal with Form Card + Engagement Row + Activity Timeline.
- [ ] ViewModal comment input posts successfully and appears in timeline.
- [ ] Like icon toggles and count updates without page reload.
- [ ] Lock icon triggers lock/unlock and updates row status icon.
- [ ] ✏ Edit icon navigates to `/document/{DocType}/{id}?mode=edit`.
- [ ] ⋮ menu shows Import/Export/Fields View/Filter Fields; hidden if no permission.
- [ ] Selecting rows shows Bulk Action Bar with correct count.
- [ ] Bulk Delete shows confirmation modal and deletes on confirm.
- [ ] Bulk Actions dropdown shows only status transitions valid for selection.
- [ ] Activity Timeline below table shows latest 20 events with user + action + timestamp.
- [ ] Column visibility toggle persists across page reload (localStorage).
- [ ] Mobile (< 768px): card layout with per-card action icons.
- [ ] Empty state shows illustration + `[+ New]` button.
- [ ] User without `can_delete` sees no Delete icon on rows.
- [ ] User without `can_write` sees no Edit icon on rows.
- [ ] All labels translated when user language ≠ English.

---

## Notes

- **Action icons vs. row click**: Clicking the title cell navigates to form. Action icons trigger their specific operation independently.
- **Like and Comment are social features layered on ERP** — they use `<doctype>_logs` as the storage layer, keeping them separate from the immutable `sys_audit_log`.
- **ViewModal is not a separate page** — it opens inline, allowing the user to quickly check details without leaving the list view.
- **⋮ menu vs. toolbar buttons**: Primary actions (`+ New`, Search) are always visible. Secondary/advanced operations live in ⋮ to reduce toolbar clutter.
- **TanStack Table is headless** — All rendering is Tailwind CSS JSX. No runtime CSS-in-JS.
- **Pagination is server-side** — `manualPagination = true`. Frontend does NOT hold all records.
- **URL reflects full state** — page, sort, search, filters → bookmarkable and shareable.
