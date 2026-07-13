# 06-05 Component Rules

## Purpose

Rules for building React components in Framee — both standard UI components (`components/core/`) and metadata-driven components (`components/dynamic/`).

---

## 1. Component Principles

1. **Single Responsibility**: One component, one responsibility. Do not build "God Components" that manage everything.
2. **Composable**: Design components to be combined (composed), not inherited.
3. **Prop-Driven**: Components receive data via `props`, not by fetching directly from APIs or global stores (except page-level components).
4. **Accessible**: Use semantically correct HTML elements (`button`, not a clickable `div`).

---

## 2. Core Components (`components/core/`)

Core components are pure building blocks — they know nothing about ERP or DocTypes.

### Core Component Template

```jsx
// components/core/Button/Button.jsx

/**
 * Primary button component.
 * @param {string} variant - 'primary' | 'secondary' | 'danger' | 'ghost'
 * @param {string} size - 'sm' | 'md' | 'lg'
 * @param {boolean} isLoading - Show loading spinner
 * @param {boolean} disabled
 * @param {React.ReactNode} children
 */
export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled = false,
  children,
  ...props
}) {
  const baseClass = 'inline-flex items-center justify-center font-medium rounded-lg transition-colors';
  
  const variantClass = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'bg-gray-100 text-gray-800 hover:bg-gray-200',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    ghost: 'text-gray-600 hover:bg-gray-100',
  }[variant];

  return (
    <button
      className={`${baseClass} ${variantClass}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && <span className="mr-2 animate-spin">⟳</span>}
      {children}
    </button>
  );
}
```

### Core Component Rules
- No `axios` or fetch calls inside core components.
- No imports from `store/`.
- No conditional logic based on DocType or permissions.
- Every core component must have an `index.js` that exports it.

---

## 3. Dynamic Components (`components/dynamic/`)

Dynamic components render UI based on DocType metadata.

### DynamicForm — Structure

```jsx
// components/dynamic/DynamicForm/DynamicForm.jsx
// Accepts DocType metadata and document data, renders the form dynamically.

export function DynamicForm({ meta, docData, mode, onSubmit, onCancel }) {
  // meta: object from GET /api/v1/meta/doctype/{DocType}
  // docData: initial form values (for Edit mode)
  // mode: 'create' | 'edit' | 'view'
  
  return (
    <form onSubmit={handleSubmit}>
      {meta.fields.map((field) => (
        <FieldRenderer key={field.fieldname} field={field} mode={mode} />
      ))}
    </form>
  );
}
```

### FieldRenderer — Switch Pattern

```jsx
// components/dynamic/FieldTypes/FieldRenderer.jsx
// Selects the correct input component based on field.fieldtype

export function FieldRenderer({ field, mode }) {
  if (mode === 'view') return <ReadOnlyField field={field} />;
  
  switch (field.fieldtype) {
    case 'Data':     return <DataField field={field} />;
    case 'Select':   return <SelectField field={field} />;
    case 'Link':     return <LinkField field={field} />;
    case 'Date':     return <DateField field={field} />;
    case 'Check':    return <CheckField field={field} />;
    case 'Table':    return <ChildTableField field={field} />;
    default:         return <DataField field={field} />;  // fallback
  }
}
```

---

## 4. Component Naming Rules

- The filename and the component name MUST match: file `ActivityTimeline.jsx` → exports `ActivityTimeline`.
- Always use **named exports**, not default exports for components.
  ```jsx
  // ✅ Named export
  export function Button() { ... }
  
  // ❌ Default export (hard to rename on import, less explicit)
  export default function Button() { ... }
  ```

---

## 5. Consistent Prop Names

The following prop names must be consistent across all Framee components:

| Prop | Type | Meaning |
|------|------|---------|
| `isLoading` | boolean | Component is in fetching/saving state |
| `isDisabled` | boolean | Component cannot be interacted with |
| `onSave` | function | Callback when data is saved |
| `onCancel` | function | Callback when action is cancelled |
| `onClose` | function | Callback when modal/drawer is closed |
| `meta` | object | DocType metadata |
| `docId` | string | UUID of the currently open document |
| `doctype` | string | Name of the DocType (e.g., 'Customer') |
