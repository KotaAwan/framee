# 08-03 Form Components

## Purpose

Documents the foundational UI components used for data entry in Framee. These are pure components (`components/core/`) that are eventually orchestrated by the `DynamicForm` component.

---

## 1. Principles of Form Components

1. **Controlled Components**: All inputs must accept `value` and `onChange` props to integrate seamlessly with React Hook Form.
2. **Error State**: Every input must be able to accept an `error` string prop and render a red border + error message below the input.
3. **Accessibility**: Every input must have a corresponding `<label>` linked via `id` and `htmlFor`.

---

## 2. Core Input Components

### `Input` (Text/Number/Password)
The standard text field.
- **Props**: `label`, `error`, `type`, `placeholder`, `disabled`, `required`.

### `Select` (Dropdown)
Standard HTML select or custom Radix-based dropdown for better styling.
- **Props**: `options` (array of `{ label, value }`), `value`, `onChange`.

### `Checkbox` / `Switch`
For boolean values (`TINYINT(1)`).
- **Props**: `checked`, `onChange`, `label`, `description` (optional text below label).

### `DatePicker`
For `Date` and `Datetime` fields. Should use a library like `react-datepicker` or `dayjs` combined with a custom UI.

---

## 3. Specialized ERP Inputs

### `LinkField` (Foreign Key Lookup)
A critical component in Framee. It looks like a standard input but behaves like an autocomplete search.
- **Behavior**:
  1. User types "PT. Ma..."
  2. Component calls `GET /api/v1/meta/link-options/Customer?search=PT.%20Ma`
  3. Displays dropdown of results.
  4. On select, sets the underlying form value to the `id` (UUID), but displays the `name` (CUST-0001) in the input.

### `ChildTable` (One-to-Many Grid)
Used for fields with `fieldtype: 'Table'` (e.g., Invoice Items).
- **Behavior**: Renders an editable grid.
- **Features**: Add row, delete row, calculate column totals.

---

## 4. Form Layout (Grid System)

Forms in Framee use a CSS Grid system defined by the DocType metadata.

Metadata fields have a `sort_order`. By default, fields are rendered in a single column or 2-column grid.

To support complex layouts, Framee supports special "Layout Fields" in metadata:
- `fieldtype: 'Section Break'` → Starts a new visual Card or Section.
- `fieldtype: 'Column Break'` → Splits the current section into multiple columns.

**Component: `FieldGroup`**
Reads the sequence of fields and groups them into CSS Grid layouts based on Section Breaks and Column Breaks.

---

## 5. React Hook Form Integration

The `DynamicForm` component wraps all inputs in `FormProvider` from `react-hook-form`.

```jsx
const form = useForm({
  resolver: zodResolver(generateZodSchema(doctypeMeta)),
  defaultValues: initialData
});

return (
  <FormProvider {...form}>
    <form onSubmit={form.handleSubmit(onSubmit)}>
      {/* FieldRenderer maps metadata to actual Input components */}
      {fields.map(field => <FieldRenderer key={field.fieldname} field={field} />)}
    </form>
  </FormProvider>
);
```

### Validation
Validation is handled entirely by **Zod**. The schema is dynamically generated from metadata (e.g., if `reqd: 1`, Zod schema makes it `.min(1, "Required")`). This ensures client-side validation perfectly matches database constraints without writing manual validation code.
