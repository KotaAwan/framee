# Implementation Progress Log — July 2026

This document records the modifications, refactorings, and UI enhancements implemented in Framee to ensure clean architecture, clean metadata, and a seamless user experience.

---

## 1. Multi-Tenant Clean-up (Engine & Migration)
* **Goal**: Deprecate and remove all multi-tenant logic because it is no longer used.
* **Backend Modifications**:
  * Cleaned up the **DatabaseEngine** and **Base Model** query builder pipelines to remove automatic tenant-scoping filters (`tenant_id`).
  * Removed `tenant_id` from core tables such as `sys_audit_log`, `sys_event_log`, and other framework schemas.
  * Verified that database transaction scopes and standard CRUD queries run directly without any tenant context leakage.

## 2. Dynamic Form Validation (`/system/sys_user`)
* **Goal**: Fix numerical validation warnings during user edit saves.
* **Frontend Fix**:
  * Corrected the input parsing in the user profile form for field **Language** (`language_id`).
  * Ensured the `<select>` options provide numeric values (representing language ID) rather than strings so the form validator doesn't trigger a validation error.

## 3. Smooth Activity Timeline (`/system/sys_user`)
* **Goal**: Smooth out the "Load More" action under the user Activity Timeline.
* **Optimizations**:
  * Re-implemented the loading logic in `ActivityTimeline.jsx` to append new logs to the existing state instead of completely re-rendering/reloading the timeline.
  * Paging for both initial load and subsequent "Load More" actions is capped strictly at **10 records**.

## 4. Fields View Modal Configuration & UI Adjustments
* **Goal**: Improve the "Fields View Configuration" modal user experience and align styles to Light/Dark modes.
* **UI Improvements**:
  * **Theme & Visibility**: Integrated theme variables (`bg-(--color-surface)` and `border-(--color-border)`) on the Modal. Custom close button styling was added for clear visibility under Light mode.
  * **Modal Alignment**: Shifted vertical position of the Modal slightly down (`pt-10 sm:pt-16`) to match the QuickView modal layout.
  * **No Real-Time Leakage (No Auto-Save)**: Changed state mapping to copy to `tempVisibleColumns` when opening the modal. Toggling checkboxes only changes the temporary state. The actual list view only updates once the **Save** button is clicked.
  * **Select All Feature**: Added a "Select All" checkbox toggle at the top of the columns list with clean spacing below it.
  * **Button Adjustments**: Changed footer button label from `"Save & Close"` to `"Save"`, and removed the unnecessary `"Cancel"` button, leaving only the primary `"Save"` and the standard Close (`X`) button.
  * **Click Outside to Close**: Configured the modal backdrop to close the modal when clicked outside.

## 5. Column Alignment & Sizing in Data Table
* **Goal**: Align columns correctly according to datatype and minimize spacing of ID fields.
* **Column Alignment**:
  * **Right Alignment**: Implemented right alignment (`text-right`) for both table headers (`<th>`) and body cells (`<td>`) on numeric fields (`Int`, `Float`, `Currency`) and the `id` column.
  * **Left Alignment**: Tipe data **Check** (which displays `"Yes"` / `"No"`) and **Link** (which displays text names) are kept left-aligned.
  * **ID Column Width**: Reduced width of the ID column header and data cells to `w-12` (48px) to remove excessive empty space between the selection checkboxes and the ID values.

## 6. Metadata Integration & Database ID Sync
* **Goal**: Register ID columns to `sys_docfield` metadata tables and resolve Link names.
* **Database Updates**:
  * Updated `01_core_seed.js` to prepend the ID field configuration `{ fieldname: 'id', label: 'ID', fieldtype: 'Int', in_list: true }` dynamically to all seeded tables.
  * Populated the `id` record for all existing tables in the `sys_docfield` table of the database.
  * Filtered out `'id'` from the dynamic mapping in `DynamicList.jsx` to prevent the ID column from rendering twice (since it's prepended manually).
  * Fixed `visibleColumns` state initialization to strictly read `in_list === 1` from the database so only `'id'`, `'code'`, and `'name'` are checked by default on `sys_user`.
  * **Link Names Resolution**: Fixed an issue in `CRUDEngine.js` link-resolving process where arrays inside `options` caused metadata lookups to fail. Link values (like `language_id`) now successfully display their text values (e.g., `English` or `Indonesian`) instead of raw IDs, and display **only the name** (removing the `"code - name"` combination).
