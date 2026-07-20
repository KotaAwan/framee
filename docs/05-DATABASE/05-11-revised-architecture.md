# Revised Database Architecture V2

Based on the latest user requirements, the database architecture has undergone a major structural revision.

## 1. Global Standard Changes
- **Primary Key (`id`)**: All tables will now use `<int unsigned primary key auto_increment>` instead of `UUID (char(36))`.
- **Metadata Fields**: Main tables will **NO LONGER** contain audit timestamp fields (`created_at`, `created_by`, `updated_at`, `updated_by`, `deleted_at`, `deleted_by`).
- **Deletion & Status**: Main tables will retain `is_deleted` (boolean 0/1) and `status` (string, `varchar(100)`, referencing `sys_workflow_state.name`).
- **Doctype References**: All relations referencing a Doctype (like `doctype` field in Workflows or Print Formats) will now use `varchar(100)` storing `sys_doctype.table_name` rather than an integer ID.

## 2. Table-Specific Logs & Versions
Instead of global audit logs, EVERY table will now have two accompanying tables for history and versioning:

### A. Logs Table (`<table_name>_logs`)
Tracks the history of actions on the record.
- `id`: int unsigned primary key auto_increment
- `doc_id`: Link to the main table's `id`
- `status`: String(100) ("Created", "Updated", "Deleted", "Liked", "Commented", or Workflow Actions)
- `content`: Text (Stores `name` of record during save/update/delete, or actual `comment` message during social events)
- `created_by`: Link to `sys_user.id`
- `created_at`: Timestamp

### B. Version Table (`<table_name>_version`)
Backs up the record data BEFORE an update occurs.
- `id`: int unsigned primary key auto_increment
- `doc_id`: (old_id) Link to the main table's `id`
- `[...field_lainnya]`: Exact copy of the main table's structure
- `backup_by`: Link to `sys_user.id`
- `backup_at`: Timestamp

## 3. Global Tracking Tables (Retained)
- **`sys_audit_log`** (or `audit_logs`): Kept for Global Logs tracking system-wide events (login, logout, roles, etc.). Social events are now redirected to `<table_name>_logs`.
- **`sys_event_log`**: Kept in the schema for future use, but its processing will be temporarily hidden/disabled.

## 4. Deprecated/Deleted Global Tables
The following global tracking tables are no longer needed and must be deleted:
- `sys_doc_version` (Replaced by individual `_version` tables)
- `sys_docfield_permission`
- `sys_print_format` (Replaced by `sys_print`)
- `sys_series` (No longer needed, using auto-increment)
- `sys_tenant` (Multi-tenant logic might be removed or altered)
- `sys_workflow_history` (Replaced by individual `_logs` tables)

## 5. Core System Tables Definition

### 4.1. sys_language
- `id` (int unsigned auto_increment)
- `code` (string) - e.g. "LANG-2607-0001"
- `name` (string) - e.g. "English"
- `is_deleted` (boolean)
- `status` (string(100)) - from sys_workflow_state.name

### 4.2. sys_translation
- `id` (int unsigned auto_increment)
- `code` (string)
- `name` (string)
- `language_id` (Link -> sys_language.id)
- `translated_text` (string)
- `is_deleted` (boolean)
- `status` (string(100))

### 4.3. sys_doctype
- `id` (int unsigned auto_increment)
- `code` (string)
- `name` (string) (Previously `label`)
- `table_name` (string) (Previously `name`)
- `module_id` (Link -> sys_module.id)
- `icon` (string)
- `auto_code` (string) (Previously `autoname`, e.g. DOCT-.YY..MM.-.XXXX)
- `is_printable` (boolean)
- `is_tree` (boolean)
- `is_single` (boolean)
- `is_deleted` (boolean)
- `status` (string(100))

### 4.4. sys_docfield
- `id` (int unsigned auto_increment)
- `doctype` (String(100) -> sys_doctype.table_name)
- `label` (string)
- `fieldname` (string)
- `fieldtype` (string: "Text", "LongText", "Password", "Select", "Link", "CheckBox", "File")
- `options` (string)
- `icon` (string)
- `default_value` (string)
- `is_required` (boolean)
- `is_read_only` (boolean)
- `is_hidden` (boolean)
- `in_list` (boolean)
- `in_filter` (boolean)
- `sort_order` (int)
*(Note: No `_logs` or `_version` tables required for sys_docfield)*

### 4.5. sys_module
- `id` (int unsigned auto_increment)
- `code` (string)
- `name` (string)
- `icon` (string)
- `is_deleted` (boolean)
- `status` (string(100))

### 4.6. sys_workspace
*(Replaces sys_workspace_shortcut)*
- `id` (int unsigned auto_increment)
- `code` (string)
- `name` (string)
- `module_id` (int unsigned)
- `type` (string)
- `target` (string)
- `icon` (string)
- `sort_order` (int)
- `is_deleted` (boolean)
- `status` (string(100))

### 4.7. sys_role
- `id` (int unsigned auto_increment)
- `code` (string)
- `name` (string)
- `parent_role_id` (int unsigned)
- `is_deleted` (boolean)
- `status` (string(100))

### 4.8. sys_permission
- `id` (int unsigned auto_increment)
- `code` (string)
- `name` (string)
- `role_id` (int unsigned)
- `doctype` (String(100) -> sys_doctype.table_name)
- `can_read` (boolean)
- `can_write` (boolean)
- `can_create` (boolean)
- `can_delete` (boolean)
- `can_submit` (boolean)
- `can_cancel` (boolean)
- `can_import` (boolean)
- `can_export` (boolean)
- `can_print` (boolean)
- `can_share` (boolean)
- `is_deleted` (boolean)
- `status` (string(100))

### 4.9. sys_workflow_state
- `id` (int unsigned auto_increment)
- `code` (string)
- `name` (string(100))
- `style` (string(50))
- `is_terminal` (boolean)
- `is_deleted` (boolean)
- `status` (string(100))

### 4.10. sys_workflow_action
- `id` (int unsigned auto_increment)
- `code` (string)
- `name` (string(100))
- `key` (string)
- `style` (string(50))
- `is_deleted` (boolean)
- `status` (string(100))

### 4.11. sys_workflow
- `id` (int unsigned auto_increment)
- `code` (string)
- `name` (string)
- `doctype` (String(100) -> sys_doctype.table_name)
- `initial_state` (String(100) -> sys_workflow_state.name)
- `is_deleted` (boolean)
- `status` (string(100))

### 4.12. sys_workflow_transition
- `id` (int unsigned auto_increment)
- `code` (string)
- `name` (string)
- `doctype` (String(100) -> sys_doctype.table_name)
- `from_state` (String(100) -> sys_workflow_state.name)
- `to_state` (String(100) -> sys_workflow_state.name)
- `action` (String(100) -> sys_workflow_action.name)
- `allow_roles` (string/JSON)
- `is_deleted` (boolean)
- `status` (string(100))

### 4.13. sys_settings
- `id` (int unsigned auto_increment)
- `code` (string)
- `name` (string)
- `default_currency` (string)
- `date_format` (string)
- `enable_registration` (boolean)
- `is_deleted` (boolean)
- `status` (string(100))

### 4.14. sys_print
*(Replaces sys_print_format)*
- `id` (int unsigned auto_increment)
- `code` (string)
- `name` (string)
- `doctype` (String(100) -> sys_doctype.table_name)
- `html_template` (text)
- `is_default` (boolean)
- `is_deleted` (boolean)
- `status` (string(100))

### 4.15. sys_user
- `id` (int unsigned auto_increment)
- `code` (string)
- `name` (string)
- `email` (string)
- `password_hash` (string)
- `pin_hash` (string)
- `google_id` (string)
- `avatar_url` (string)
- `phone` (string)
- `language_id` (int unsigned)
- `timezone` (string)
- `date_format` (string)
- `is_deleted` (boolean)
- `status` (string(100))

### 4.16. sys_user_role
- `id` (int unsigned auto_increment)
- `code` (string)
- `name` (string)
- `user_id` (int unsigned)
- `role_id` (int unsigned)
- `is_deleted` (boolean)
- `status` (string(100))
