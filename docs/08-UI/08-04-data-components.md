# 08-04 Data Components

## Purpose

Documents the components used to display collections of data, primarily the Data Table (List View) and Pagination.

---

## 1. Data Table (TanStack Table)

The core of the List View is powered by **TanStack Table v8** (formerly React Table). It is a headless utility, meaning Framee defines the UI (Tailwind `<table>`), and TanStack handles the logic (sorting, column resizing, pagination state).

### Features Required
1. **Dynamic Columns**: Columns are generated from `meta.fields` where `in_list_view = 1`.
2. **Server-Side Sorting**: Clicking a column header updates the URL query params (`?sort=customer_name:asc`), triggering a data refetch.
3. **Row Selection**: Checkboxes on the left column for bulk actions (Delete, Submit).
4. **Clickable Rows**: Clicking anywhere on a row navigates to `/document/[doctype]/[id]`.
5. **Sticky Header**: For scrolling through long lists.

### Column Formatting
Data returned from the API must be formatted before display:
- `Currency` fields → Formatted with `Intl.NumberFormat`.
- `Date` fields → Formatted to `DD-MM-YYYY` (or user preference).
- `Status` column → Rendered as a colored `Badge` component.

---

## 2. Pagination Component

Pagination is fully server-side. The component reads the `meta` object from the API response:

```json
"meta": {
  "total": 145,
  "page": 1,
  "pageSize": 20,
  "totalPages": 8
}
```

**UI Layout**:
- Left: "Showing 1 to 20 of 145 results"
- Right: Previous Button, Page Numbers (e.g., 1, 2, 3 ... 8), Next Button.
- Dropdown: "Rows per page: [ 20 | 50 | 100 ]"

Changing a page updates the URL query parameters, which re-triggers the data fetch.

---

## 3. Filter Bar

Located above the Data Table.

1. **Quick Search**: A text input mapped to the `?search=` API parameter.
2. **Standard Filters**: A dropdown to quickly filter by `status`.
3. **Advanced Filters**: A "Filter" button that opens a Popover or Drawer allowing users to add multiple conditions:
   - Field: `customer_type`
   - Operator: `=`
   - Value: `Company`

---

## 4. Empty States & Loading

- **Loading State**: Display a skeleton loader (shimmer effect) inside the table rows instead of a full-screen spinner. This keeps the layout stable.
- **Empty State**: If no data is returned, display an illustration with a message "No records found" and a primary button "Create New [DocType]".
