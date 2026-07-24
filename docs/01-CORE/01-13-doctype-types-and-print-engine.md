# DocType Classification & Print Engine

Document Identifier: `DOC-01-13`  
Target Audience: Core Engineers, Module Developers, Architects  

---

## 1. Overview & Classification of DocTypes

In Framee (similar to ERPNext framework principles), every entity in the system is defined by a **DocType** (`sys_doctype`). However, depending on business intent, DocTypes are classified into distinct structural and behavioral categories stored in `sys_doctype.type`.

```
                    ┌─────────────────────────┐
                    │       sys_doctype       │
                    │  (type, parent_id, ...) │
                    └────────────┬────────────┘
                                 │
     ┌──────────────────┬────────┴─────────┬──────────────────┐
     ▼                  ▼                  ▼                  ▼
┌──────────┐      ┌───────────┐      ┌───────────┐      ┌───────────┐
│ Standard │      │Child Table│      │  Single   │      │   Page    │
└──────────┘      └───────────┘      └───────────┘      └───────────┘
 (Master/     (Subgrid detail,    (1 record only,   (Custom UI/
 Standard DB)  no standalone list) no List View)     Dashboard)
```

---

## 2. DocType Categories (`sys_doctype.type`)

### 2.1 Standard / Master DocType (`type = "Standard"`)
- **Description**: Represents independent business entities (e.g. `Customer`, `Item`, `Supplier`, `Employee`, `sys_doctype`).
- **Characteristics**:
  - Creates a dedicated physical table (`<table_name>`) in MySQL containing: `id`, `code`, `<fields>`, `is_deleted`, `status`.
  - Has full List View (`/core/[doctype]`) and Form View (`/core/[doctype]/[id]`).
  - Supports CRUD, filters, search, and pagination.

### 2.2 Child Table DocType (`type = "Child Table"`)
- **Description**: Represents line items or detail subgrids attached to a parent document (e.g. `sys_docfield` attached to `sys_doctype`, `sales_invoice_item` attached to `sales_invoice`).
- **Characteristics**:
  - `type = "Child Table"` or referenced in a parent field with `fieldtype: "Table"`.
  - Does **not** have an independent List View page in navigation or routing.
  - Stored physically with parent references (`parent_id`, `parent_doctype`, `parent_field`, `idx`) or specialized child tables like `sys_docfield` (`doctype`, `sort_order`).
  - Rendered inline within the parent form via `TableDocField` / `ChildFormModal` / `FieldSettingsModal`.

### 2.3 Single DocType (`type = "Single"`)
- **Description**: Global configuration or singleton records where only **one** instance exists for the system (e.g. `Company Settings`, `System Parameters`).
- **Characteristics**:
  - `type = "Single"` or `is_single = 1`.
  - Does **not** render a List View page; navigating to its route opens the single Form View directly.
  - On initial open, if no record exists, a default blank template is returned for immediate editing.

### 2.4 Page / Custom View (`type = "Page"`)
- **Description**: Custom dashboard or application page layout.

---

## 3. Parent-Child Relationship Model

Parent documents and Child Tables are linked dynamically via metadata and structural definitions:

```
┌────────────────────────────────┐         ┌────────────────────────────────┐
│      Parent: sys_doctype       │         │      Child: sys_docfield       │
├────────────────────────────────┤ 1     * ├────────────────────────────────┤
│ id: 10001                      │─────────┤ id: 495                        │
│ name: "Customer"               │         │ doctype: "sys_doctype"         │
│ type: "Standard"               │         │ fieldname: "customer_name"     │
│ table_name: "customers"        │         │ fieldtype: "Data"              │
│ fields: [ ... ]                │         │                                │
└────────────────────────────────┘         └────────────────────────────────┘
```

When fetching a parent record via `CRUDEngine.get(doctype, id)`:
1. Main table record is queried.
2. Parent fields of type `Table` are inspected for `options` (child DocType name).
3. Child records matching `parent_id` (or `doctype` for `sys_docfield`) are automatically fetched, sorted by `idx` or `sort_order`, and attached as an array to `record[field.fieldname]`.

---

## 4. Print Engine & Print Formats (`sys_print`)

Transactional and Master DocTypes frequently require formatted outputs (vouchers, invoices, receipts, reports). This is handled by **`PrintEngine`**.

### 4.1 Print Engine Architecture

```
                               ┌───────────────────────────┐
                               │   CRUDEngine.get(doc,id)  │
                               └─────────────┬─────────────┘
                                             │ (Raw JSON Data + Child Rows)
                                             ▼
┌─────────────────────────┐    ┌───────────────────────────┐
│   sys_print Template    │───►│  PrintEngine (Handlebars) │
└─────────────────────────┘    └─────────────┬─────────────┘
 (HTML + CSS Handlebars)                     │
                                             ▼
                               ┌───────────────────────────┐
                               │ Rendered HTML / PDF View  │
                               └───────────────────────────┘
```

### 4.2 Template Storage (`sys_print`)
Print formats are stored in `sys_print`:
- `doctype`: The target DocType (e.g. `sales_invoice`).
- `name`: Template name (e.g. `Standard Invoice`, `Thermal Receipt`).
- `is_default`: Boolean flag indicating if this is the default print format.
- `html_template`: Handlebars HTML string containing placeholders (e.g. `{{doc.code}}`, `{{#each doc.items}}...{{/each}}`).

### 4.3 Rendering Process
1. **Data Fetching**: `PrintEngine.renderHtml(doctype, id, userId, formatName)` retrieves the document data including all child table rows.
2. **Template Compilation**: If a template exists in `sys_print`, Handlebars compiles the HTML using `docData`. Custom helpers like `formatCurrency` and `formatDate` are executed.
3. **Fallback Rendering**: If no template exists in `sys_print`, `PrintEngine` dynamically generates a clean grid layout based on the active fields in metadata.
4. **PDF Output**: Puppeteer compiles the HTML into a downloadable PDF binary on demand via `PrintEngine.renderPdf()`.

---

## 5. Summary Matrix

| DocType Type (`type`) | Physical Table | List View | Child Table Support | Submittable / WF | Print Engine |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Standard** | `<table_name>` | ✅ Yes | ✅ Yes (as Parent) | Optional | ✅ Standard / Fallback |
| **Child Table** | Managed / Special | ❌ No | ❌ No (Embedded only) | ❌ No | ❌ N/A |
| **Single** | `<table_name>` | ❌ No (Direct Form) | ✅ Yes | Optional | ✅ Supported |
| **Page** | N/A | ❌ No | ❌ N/A | ❌ N/A | ❌ N/A |

---
