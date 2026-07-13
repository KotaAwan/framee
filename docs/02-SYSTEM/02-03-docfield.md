# 02-03 DocField

## Purpose

DocField defines the **individual field-level schema** for a DocType. Each DocField record specifies one field within a DocType — its name, type, label, validation rules, display properties, and AI-friendly metadata.

DocFields are the atoms of Framee's metadata system. Every form input, list column, API parameter, and database column that the system generates for a DocType is derived directly from its DocField definitions. Without DocFields, a DocType has no structure.

---

## Goals

1. Allow administrators to define each field of a DocType declaratively through the admin UI.
2. Drive all downstream behavior from field definitions: database column types, form inputs, API validation, list columns, and filter options.
3. Support a rich set of field types appropriate for enterprise ERP data modeling.
4. Provide AI-friendly field metadata (`description`, `hint`, `example`) for every field.
5. Support field grouping, ordering, and layout configuration within a DocType form.
6. Support child table fields (Table type) that link to another DocType as a one-to-many relationship.

---

## Scope

### In Scope
- DocField definition management (create, read, update, delete)
- Field type system with all supported field types
- Field-level validation configuration (required, max_length, unique)
- Field display configuration (sort_order, section, column_width, in_list_view, in_standard_filter)
- Field visibility configuration (is_hidden, is_read_only)
- Conditional field visibility (depends_on)
- Link field configuration (options = target DocType)
- Select field configuration (options = newline-separated values)
- Table field configuration (options = child DocType name)
- Field-level database column creation via integration with the Database Engine

### Out of Scope
- Field-level permissions (defined in sys_docfield_permission via Permission Engine — `01-07`)
- Form layout rendering (handled by Dynamic Form — `03-02`)
- Field computation/formulas (future enhancement)

---

## Functional Requirements

### FR-001 Field Definition
- Each DocField must specify: `fieldname`, `label`, `fieldtype`.
- `fieldname` must be unique within a DocType.
- `fieldname` must follow naming convention: lowercase alphanumeric with underscores.

### FR-002 Field Types
- The system must support the following field types:

| Category | Field Types |
|----------|------------|
| Text | Data, Text, Long Text, HTML |
| Number | Int, Float, Currency, Percent |
| Date/Time | Date, Datetime, Time |
| Selection | Select, Link, Dynamic Link, MultiSelect |
| Boolean | Check |
| File | Attach, Attach Image |
| Layout | Section Break, Column Break |
| Special | Table (child table), Password, Signature |

### FR-003 Field Validation Configuration
- `is_required` — field must have a value on save.
- `max_length` — maximum character length for Data/Text fields.
- `min_value` / `max_value` — numeric range constraints for Int/Float/Currency.
- `is_unique` — field value must be unique within the DocType per tenant.

### FR-004 Field Display Configuration
- `sort_order` — controls field rendering order in the form.
- `section` — groups fields under a named section in the form.
- `column_width` — grid column span (1–12) for multi-column layout.
- `in_list_view` — field appears as a column in the list view.
- `in_standard_filter` — field appears as a quick filter in the list view.

### FR-005 Conditional Visibility
- `depends_on` — a simple expression that controls whether the field is visible.
- Expression format: `fieldname == 'value'` or `fieldname != 'value'`.
- The form re-evaluates visibility in real-time as field values change.

### FR-006 Link Field
- A Link field references a specific DocType (set in `options`).
- When a user selects a Link field value, the system searches the linked DocType's `search_fields`.
- Link integrity is validated on save — the referenced record must exist.

### FR-007 Table Field (Child Table)
- A Table field references a child DocType (set in `options`).
- The child DocType must have a `parent` Link field pointing back to the parent DocType.
- Child records are saved atomically with the parent in a single transaction.

### FR-008 AI Metadata
- Every DocField must have a `description` field (mandatory).
- `hint` — placeholder text or example format shown in the form input.
- `example` — a concrete example value for AI agent use.
- These fields are included in the AI schema export.

---

## Architecture

```
DocType (sys_doctype)
  └── DocFields (sys_docfield) [one-to-many]
        │
        ├──► Database Engine: ALTER TABLE dt_{doctype} ADD COLUMN {fieldname} {type}
        ├──► CRUD Engine: input validation logic
        ├──► API Engine: field names in request/response schema
        ├──► Dynamic Form: form input rendering
        ├──► Dynamic List: column configuration
        └──► Metadata Engine: cached as part of DocType metadata
```

### Field Type to Behavior Mapping

| Field Type | DB Column | Form Input | List Column | Filter |
|------------|-----------|------------|------------|--------|
| Data | VARCHAR(255) | text input | Yes | text search |
| Int | INT | number input | Yes | range filter |
| Float | DECIMAL(18,6) | number input | Yes | range filter |
| Currency | DECIMAL(18,2) | currency input | Yes | range filter |
| Date | DATE | date picker | Yes | date range |
| Datetime | DATETIME | datetime picker | Yes | date range |
| Select | VARCHAR(100) | dropdown | Yes | select filter |
| Link | VARCHAR(36) | autocomplete | Yes | select filter |
| Check | TINYINT(1) | checkbox | Yes | boolean filter |
| Text | TEXT | textarea | No | — |
| Long Text | LONGTEXT | rich text | No | — |
| Attach | TEXT | file upload | No | — |
| Table | (child table) | child grid | No | — |
| Section Break | — | section divider | No | — |
| Column Break | — | column divider | No | — |

---

## Database Design

### `sys_docfield` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | VARCHAR(36) | UUID PK |
| `tenant_id` | VARCHAR(36) | Tenant reference |
| `doctype_id` | VARCHAR(36) | FK → sys_doctype.id |
| `fieldname` | VARCHAR(100) | Programmatic name (snake_case) |
| `label` | VARCHAR(150) | Display label |
| `fieldtype` | VARCHAR(50) | Field type identifier |
| `options` | TEXT | Select options / Link DocType / child DocType |
| `default_value` | VARCHAR(255) | Default value on new record |
| `is_required` | TINYINT(1) | Mandatory field |
| `is_read_only` | TINYINT(1) | Non-editable |
| `is_hidden` | TINYINT(1) | Hidden from UI |
| `is_unique` | TINYINT(1) | Unique value constraint per tenant |
| `max_length` | INT | Max character length (Data/Text) |
| `min_value` | DECIMAL(18,6) | Minimum numeric value |
| `max_value` | DECIMAL(18,6) | Maximum numeric value |
| `in_list_view` | TINYINT(1) | Show in list view columns |
| `in_standard_filter` | TINYINT(1) | Show in filter bar |
| `depends_on` | VARCHAR(255) | Conditional visibility expression |
| `description` | TEXT | AI-friendly field description (required) |
| `hint` | VARCHAR(255) | Form placeholder/hint text |
| `example` | VARCHAR(255) | Example value for AI context |
| `sort_order` | INT | Display order in form |
| `section` | VARCHAR(100) | Section grouping name |
| `column_width` | TINYINT(4) | Grid column span (1–12) |
| `created_by` | VARCHAR(36) | FK → sys_user.id |
| `updated_by` | VARCHAR(36) | FK → sys_user.id |
| `created_at` | DATETIME | Auto timestamp |
| `updated_at` | DATETIME | Auto timestamp |
| `is_deleted` | TINYINT(1) | Soft delete |

### Indexes

```sql
UNIQUE INDEX idx_docfield_unique (tenant_id, doctype_id, fieldname)
INDEX idx_docfield_doctype (doctype_id, sort_order)
INDEX idx_docfield_list_view (doctype_id, in_list_view)
INDEX idx_docfield_filter (doctype_id, in_standard_filter)
```

---

## API Design

DocField is managed as a child of DocType via the DocType form (inline child table). It can also be managed standalone:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/doc/DocField?filters[doctype_id]={id}` | List fields for a DocType |
| `POST` | `/api/v1/doc/DocField` | Create a new field |
| `GET` | `/api/v1/doc/DocField/:id` | Get field details |
| `PUT` | `/api/v1/doc/DocField/:id` | Update field |
| `DELETE` | `/api/v1/doc/DocField/:id` | Soft delete field |
| `POST` | `/api/v1/doc/DocField/reorder` | Bulk update sort_order |

#### Example — `POST /api/v1/doc/DocField` (Create)

```json
{
  "doctype_id": "customer-doctype-uuid",
  "fieldname": "customer_name",
  "label": "Customer Name",
  "fieldtype": "Data",
  "is_required": 1,
  "in_list_view": 1,
  "in_standard_filter": 1,
  "description": "The full legal name of the customer as registered.",
  "hint": "e.g. PT. Maju Jaya Indonesia",
  "example": "PT. Maju Jaya Indonesia",
  "sort_order": 10,
  "section": "Basic Information",
  "column_width": 6
}
```

---

## UI Behaviour

### DocField Management in DocType Form
- Fields are managed in a sortable child table within the DocType form.
- Drag-and-drop reordering updates `sort_order` for all affected fields.
- A "Add Field" button opens an inline form for field configuration.
- Field type selection dynamically shows/hides relevant configuration options (e.g., "Options" input appears only for Select and Link types).

### Live Form Preview
- The DocType form includes a "Preview" tab showing a real-time rendering of how the form will look with the current field configuration.

### Section and Column Layout
- `Section Break` and `Column Break` field types are visual layout markers.
- `Section Break` creates a new labeled group.
- `Column Break` creates a new column within the current section.
- `column_width` (1–12) controls the field's width in a 12-column grid.

---

## Configuration

| Config Key | Default | Description |
|------------|---------|-------------|
| `DOCTYPE_SCHEMA_AUTO_MIGRATE` | `true` | Auto-apply ALTER TABLE on DocField save |
| `DOCFIELD_MAX_PER_DOCTYPE` | `200` | Maximum fields per DocType |
| `DOCFIELD_REQUIRE_DESCRIPTION` | `true` | Enforce description field on all DocFields |

---

## Validation Rules

- `fieldname` must be unique within a DocType.
- `fieldname` must match `^[a-z][a-z0-9_]*$`.
- `fieldname` must not be a reserved system name: `id`, `tenant_id`, `created_by`, `updated_by`, `created_at`, `updated_at`, `is_deleted`, `docstatus`, `workflow_state`.
- `fieldtype` must be one of the registered field types.
- Link fields must have `options` set to a valid, existing DocType name.
- Select fields must have `options` with at least one non-empty value (newline-separated).
- Table fields must have `options` set to a valid DocType that is a child table.
- `description` is mandatory when `DOCFIELD_REQUIRE_DESCRIPTION = true`.
- `column_width` must be an integer between 1 and 12.
- `sort_order` must be a positive integer. Fields with duplicate sort orders are auto-resolved.

---

## Security

- Creating and modifying DocFields requires System Manager or Module Manager role.
- DocField changes trigger schema migrations — DDL permission at the DB Engine level is required.
- `fieldname` is sanitized before use as a column name to prevent DDL injection.
- Soft-deleted DocFields are hidden from the form but their database columns are retained.

---

## Events

| Event | Trigger |
|-------|---------|
| `DocField.after_insert` | New field created → triggers DB column add |
| `DocField.after_update` | Field settings modified → may trigger DB schema change |
| `DocField.after_delete` | Field soft deleted → column retained in DB |

### Listened Events

| Event | Action |
|-------|--------|
| `DocField.after_insert` | Invalidate parent DocType metadata cache |
| `DocField.after_update` | Invalidate parent DocType metadata cache |

---

## Performance

- DocFields are loaded as part of the DocType metadata object — no separate query per field.
- The join query `sys_doctype + sys_docfield` is executed once per DocType cache miss and the full result is cached.
- Field ordering uses the pre-sorted `sort_order` index — no in-application sorting needed.
- `in_list_view` and `in_standard_filter` fields are pre-filtered by the index, not by application code.

---

## Future Improvements

- **Computed Fields** — Read-only fields whose values are calculated from other fields using a safe expression.
- **Field Templates** — Reusable field definitions that can be inserted into multiple DocTypes.
- **Field Groups** — Named groups of fields that can be applied to a DocType as a bundle.
- **Field Deprecation** — Mark a field as deprecated (hidden from new records, preserved in old records).
- **AI Field Suggestion** — AI recommends field names, types, and descriptions based on DocType context.
- **Rich Validation** — Pattern-based (regex) validation for Data fields configured in metadata.

---

## Acceptance Criteria

- [ ] Creating a DocField with a unique fieldname and valid type succeeds.
- [ ] Creating a DocField with a duplicate fieldname within the same DocType returns a validation error.
- [ ] After creating a DocField, the corresponding column appears in the DocType's database table.
- [ ] A required field that is empty on save returns a field-specific validation error.
- [ ] A Link field with an invalid referenced DocType name returns a validation error.
- [ ] A Select field with no options defined returns a validation error.
- [ ] `in_list_view = 1` fields appear as columns in the Dynamic List.
- [ ] `in_standard_filter = 1` fields appear as filters in the Dynamic List.
- [ ] `depends_on` correctly hides/shows a field based on another field's value in the form.
- [ ] Section Break creates a visible grouped section in the rendered form.
- [ ] Drag-and-drop reordering in the DocType form updates `sort_order` and the form renders in the new order.
- [ ] `description` field is mandatory — creating a DocField without it (when enforced) returns a validation error.
- [ ] Soft-deleting a DocField removes it from the form but the database column is preserved.

---

## Notes

- DocField changes after activation should be handled carefully — dropping a field in the UI does NOT drop the database column. Data preservation is paramount.
- The `Table` field type is used for one-to-many relationships. The child DocType's records are stored in their own `dt_*` table with a `parent_id` column referencing the parent record.
- `Section Break` and `Column Break` fields have no `fieldname` requirement and generate no database column — they are purely layout markers.
- AI agents generating DocField configurations should be informed that `description` is mandatory, that `hint` and `example` significantly improve AI comprehension of the field's intent, and that `fieldname` must be lowercase snake_case.
