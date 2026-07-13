# 08-05 Feedback Components

## Purpose

Documents the components used to communicate status, errors, and require user confirmation.

---

## 1. Toast / Snackbar

Used for non-blocking notifications (e.g., "Saved successfully", "Validation error").

- **Library**: `react-hot-toast` or `sonner`.
- **Position**: Top-Right or Bottom-Right.
- **Types**:
  - Success (Green icon)
  - Error (Red icon, stays visible longer)
  - Info (Blue icon)

**Usage in Code**:
```javascript
import { toast } from 'react-hot-toast';

// Inside form submit handler
try {
  await api.post('/doc/Customer', data);
  toast.success('Customer saved successfully');
} catch (error) {
  toast.error(error.response?.data?.error?.message || 'Failed to save');
}
```

---

## 2. Modals (Dialogs)

Used for actions that require focus and block the main UI.

- **Library**: Radix UI Dialog (for accessibility and focus trapping).
- **Variations**:
  1. **Confirmation Modal**: "Are you sure you want to delete this document?" (Cancel / Confirm buttons).
  2. **Form Modal**: Used for quick entry (e.g., adding a new Customer from within a Sales Invoice form).

**Rule**: Do not use modals for complex, multi-step forms. Redirect to a full page instead.

---

## 3. Alerts

Inline banners used to display important information at the top of a form or list.

- **Types**: Warning, Danger, Info.
- **Example**: "This document is Locked and cannot be edited."

---

## 4. Badges (Status Indicators)

Used extensively in List views and Page Headers to denote status.

- **Component**: `<Badge variant="success">Active</Badge>`
- **Color Mapping** (Standard):
  - `Draft` → Gray / Neutral
  - `Submitted` → Blue / Primary
  - `Locked` → Purple / Indigo
  - `Cancelled` → Orange / Warning
  - `Deleted` → Red / Danger
  - `Active` → Green / Success
  - `Archived` → Gray / Neutral

---

## 5. Activity Timeline UI

A specialized feedback component used at the bottom of forms to display `dt_*_logs` data.

- Displays a vertical line connecting events.
- **System Event**: Small dot icon, text: "Budi submitted this document 2 hours ago."
- **Comment Event**: User avatar, chat bubble container with comment text, reply button.
- **Input Area**: A textarea at the top of the timeline to add a new comment.
