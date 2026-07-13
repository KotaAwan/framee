# 05-03 Metadata Tables

## Purpose

Documents the schema for the core tables that make up the Metadata Engine. These tables store the structure (blueprint) for all data tables (`dt_*`) in the system.

---

## 1. Overview

Metadata tables reside in the `sys_` namespace. They are core tables that are not dynamically generated, but rather seeded during the initial framework installation.

Primary tables:
- `sys_module`: Module/category grouping.
- `sys_doctype`: Table definition (e.g., table name, workflow features).
- `sys_docfield`: Column/field definition (data type, validation, UI label).

---

## 2. Table: `sys_module`

Stores the list of application modules (e.g., System, Core, CRM, HRIS).

```sql
CREATE TABLE sys_module (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  
  name VARCHAR(100) NOT NULL,
  icon VARCHAR(50) NULL,
  description TEXT NULL,
  is_active TINYINT(1) DEFAULT 1,
  
  -- Standard System Columns
  status VARCHAR(20) DEFAULT 'Active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE KEY uniq_module_name (tenant_id, name)
);
```

---

## 3. Table: `sys_doctype`

Stores entity definitions. Each row here (e.g., `Customer`) represents one data table in the database (`dt_customer`).

```sql
CREATE TABLE sys_doctype (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  
  module_id VARCHAR(36) NOT NULL,       -- FK to sys_module
  name VARCHAR(100) NOT NULL,           -- e.g., 'SalesInvoice'
  is_submittable TINYINT(1) DEFAULT 0,  -- Does it have a Draft->Submitted lifecycle?
  is_tree TINYINT(1) DEFAULT 0,         -- Is it a tree structure (parent/child)?
  track_changes TINYINT(1) DEFAULT 1,   -- Record field diff to sys_audit_log?
  is_active TINYINT(1) DEFAULT 1,
  
  name_series VARCHAR(50) NULL,         -- Auto-naming pattern (e.g., INV-.YYYY.-.####)
  plugin_name VARCHAR(100) NULL,        -- Metadata origin (NULL = core)
  
  -- Standard System Columns
  status VARCHAR(20) DEFAULT 'Active',
  created_by VARCHAR(36),
  updated_by VARCHAR(36),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE KEY uniq_doctype_name (tenant_id, name),
  CONSTRAINT fk_doctype_module FOREIGN KEY (module_id) REFERENCES sys_module(id)
);
```

---

## 4. Table: `sys_docfield`

Stores column definitions for each DocType. Each row here will be translated into a physical column in the `dt_*` table by the Database Engine.

```sql
CREATE TABLE sys_docfield (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  
  doctype_id VARCHAR(36) NOT NULL,      -- FK to sys_doctype
  fieldname VARCHAR(100) NOT NULL,      -- e.g., 'customer_name'
  label VARCHAR(100) NOT NULL,          -- e.g., 'Customer Name'
  fieldtype VARCHAR(50) NOT NULL,       -- Data, Int, Select, Link, Table, etc.
  
  -- Validation & Constraints
  reqd TINYINT(1) DEFAULT 0,            -- Is Required?
  unique_field TINYINT(1) DEFAULT 0,    -- Is Unique?
  options TEXT NULL,                    -- For Select (csv list) or Link (DocType name)
  default_value VARCHAR(255) NULL,      -- Default value
  
  -- UI / Display logic
  in_list_view TINYINT(1) DEFAULT 0,    -- Show on List page?
  read_only TINYINT(1) DEFAULT 0,
  hidden TINYINT(1) DEFAULT 0,
  sort_order INT DEFAULT 0,             -- Render order in UI form
  
  -- Standard System Columns
  status VARCHAR(20) DEFAULT 'Active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE KEY uniq_docfield_name (tenant_id, doctype_id, fieldname),
  CONSTRAINT fk_docfield_doctype FOREIGN KEY (doctype_id) REFERENCES sys_doctype(id) ON DELETE CASCADE
);
```

---

## 5. Physical Sync (DDL)

- Changes (Insert/Update/Delete) to `sys_docfield` must trigger the `MetadataEngine` to call `DatabaseEngine.alterTable()`.
- If a field's `reqd` (required) is changed to true, the Database Engine must attempt to add a `NOT NULL` clause. If there is existing data that is empty, the DDL will fail and must be caught gracefully.
