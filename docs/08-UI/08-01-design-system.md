# 08-01 Design System

## Purpose

Documents the UI Design System for Framee. The design system ensures a consistent, modern, and highly usable interface across all modules. It acts as the single source of truth for UI components, colors, typography, and layout spacing.

---

## 1. Core Technology Stack

- **Framework**: Next.js 15 (Pages Router) + React 19
- **Styling**: Tailwind CSS v3 (Utility-first CSS)
- **Icons**: Lucide React (Clean, consistent SVG icons)
- **Component Primitives**: Radix UI (Unstyled, accessible components for complex interactive widgets like Dialogs, Popovers, and Dropdowns)
- **Data Table**: TanStack Table v8 (Headless table utility)
- **Form Handling**: React Hook Form + Zod (Validation)

---

## 2. Design Principles

1. **Information Density**: As an ERP, users need to see a lot of data at once. The design must support compact views without feeling cluttered.
2. **Metadata-Driven UI**: Components must be designed to accept dynamic configuration (metadata) rather than hardcoded props.
3. **Accessibility (a11y)**: All interactive elements must support keyboard navigation and screen readers (this is why Radix UI is used for primitives).
4. **Themeable**: The system must support Dark Mode and configurable color themes per tenant/user.
5. **AdminLTE Inspired Layout**: Familiar sidebar-navigation pattern with a top app bar, optimized for modern displays.

---

## 3. Tailwind Configuration (Themes)

Framee uses Tailwind CSS variables to support dynamic themes. Instead of hardcoding `bg-blue-600`, we use semantic names like `bg-primary-600`.

### Color Palette

| Semantic Name | Purpose | Example Tailwind Class |
|---------------|---------|------------------------|
| **Primary** | Main brand color, primary buttons, active states | `bg-primary-600`, `text-primary-500` |
| **Secondary** | Secondary actions, neutral accents | `bg-secondary-100`, `text-secondary-700` |
| **Success** | Positive actions, completed status | `text-success-600`, `bg-success-50` |
| **Warning** | Alerts, pending status, warnings | `text-warning-600`, `bg-warning-50` |
| **Danger** | Destructive actions, errors, deleted status | `text-danger-600`, `bg-danger-50` |
| **Surface** | Cards, modals, sidebars (backgrounds) | `bg-surface`, `bg-surface-muted` |
| **Border** | Dividers, input borders | `border-border`, `border-border-focus` |

### Typography

- **Font Family**: Inter (sans-serif) for UI elements, Fira Code (monospace) for code/logs.
- **Base Size**: 14px (standard for data-heavy ERPs, `text-sm` in Tailwind).
- **Headings**: Clear hierarchy (H1 for Page Titles, H2 for Sections, H3 for Cards).

---

## 4. Theme System Architecture

The theme is managed via CSS variables in the global stylesheet (`globals.css`).

```css
/* globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --color-primary-50: 239 246 255;
    --color-primary-600: 37 99 235;
    --color-surface: 255 255 255;
    --color-text-main: 17 24 39;
  }

  .dark {
    --color-primary-50: 30 58 138;
    --color-primary-600: 59 130 246;
    --color-surface: 31 41 55;
    --color-text-main: 243 244 246;
  }
}
```

The user's theme preference (Light/Dark/System) is stored in `localStorage` and managed by a `ThemeProvider` at the `_app.js` level to prevent hydration mismatch flashes.

---

## 5. Component Categories

Components in Framee are strictly categorized:

1. **Layout Components** (`components/layout/`): Sidebar, Navbar, AppShell, PageHeader.
2. **Core Components** (`components/core/`): Pure UI elements that know nothing about business logic (Button, Input, Badge, Modal).
3. **Dynamic Components** (`components/dynamic/`): Components that read DocType metadata to render themselves (DynamicForm, DynamicList).

---

## 6. CSS Best Practices

1. **Do not use `@apply` in CSS**: Write utility classes directly in the React component's `className` prop. Using `@apply` defeats the purpose of Tailwind.
2. **Use `clsx` and `tailwind-merge`**: For composing dynamic class names safely without specificity conflicts.
   ```javascript
   import { clsx } from "clsx";
   import { twMerge } from "tailwind-merge";
   
   export function cn(...inputs) {
     return twMerge(clsx(inputs));
   }
   ```
3. **Avoid fixed widths/heights**: Let content dictate height, and use Flexbox/Grid to manage width.
4. **Z-Index scale**: Use a standardized z-index scale (e.g., Header=40, Modal=50, Toast=60).
