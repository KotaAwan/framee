# 05-04 Security Tables

## Purpose

Documents the schema for tables related to Security, Access (Permissions), and Identity (Users/Roles) in Framee.

---

## 1. Overview

Authentication (who is this user) and Authorization (what are they allowed to do) are controlled through these tables.

Primary tables:
- `sys_user`: User identity.
- `sys_role`: Role definitions (e.g., "Sales Manager").
- `sys_user_role`: Many-to-Many junction between User and Role.
- `sys_permission`: Specific access rights of a Role to a DocType.

---

## 2. Table: `sys_user`

```sql
CREATE TABLE sys_user (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  
  email VARCHAR(255) NOT NULL,          -- Used for login
  password_hash VARCHAR(255) NOT NULL,  -- Bcrypt hash
  full_name VARCHAR(100) NOT NULL,
  avatar_url VARCHAR(255) NULL,
  
  last_login DATETIME NULL,
  is_active TINYINT(1) DEFAULT 1,
  
  -- Standard System Columns
  status VARCHAR(20) DEFAULT 'Active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE KEY uniq_user_email (tenant_id, email)
);
```

---

## 3. Table: `sys_role`

```sql
CREATE TABLE sys_role (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  
  name VARCHAR(50) NOT NULL,            -- e.g., 'System Manager', 'Sales User'
  description TEXT NULL,
  
  -- Standard System Columns
  status VARCHAR(20) DEFAULT 'Active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE KEY uniq_role_name (tenant_id, name)
);
```

---

## 4. Table: `sys_user_role`

Junction / pivot table for the Many-to-Many relationship.

```sql
CREATE TABLE sys_user_role (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  
  user_id VARCHAR(36) NOT NULL,
  role_id VARCHAR(36) NOT NULL,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE KEY uniq_user_role (tenant_id, user_id, role_id),
  CONSTRAINT fk_ur_user FOREIGN KEY (user_id) REFERENCES sys_user(id) ON DELETE CASCADE,
  CONSTRAINT fk_ur_role FOREIGN KEY (role_id) REFERENCES sys_role(id) ON DELETE CASCADE
);
```

---

## 5. Table: `sys_permission`

Determines what rights a Role has over a DocType. This table is read by the Permission Engine on every request.

```sql
CREATE TABLE sys_permission (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  
  role_id VARCHAR(36) NOT NULL,
  doctype_id VARCHAR(36) NOT NULL,      -- FK to sys_doctype
  
  -- Authorization Level
  perm_level INT DEFAULT 0,             -- 0 = Document level, >0 = Field level
  
  -- Access Rights (Boolean)
  can_read TINYINT(1) DEFAULT 0,
  can_write TINYINT(1) DEFAULT 0,
  can_create TINYINT(1) DEFAULT 0,
  can_delete TINYINT(1) DEFAULT 0,
  can_submit TINYINT(1) DEFAULT 0,
  can_cancel TINYINT(1) DEFAULT 0,
  can_amend TINYINT(1) DEFAULT 0,
  can_print TINYINT(1) DEFAULT 0,
  can_export TINYINT(1) DEFAULT 0,
  can_import TINYINT(1) DEFAULT 0,
  
  -- Field Level (optional, if perm_level > 0)
  -- Stores a JSON array of field names whose rights are restricted at this level
  restricted_fields JSON NULL,
  
  -- System Columns
  status VARCHAR(20) DEFAULT 'Active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE KEY uniq_perm (tenant_id, role_id, doctype_id, perm_level),
  CONSTRAINT fk_perm_role FOREIGN KEY (role_id) REFERENCES sys_role(id) ON DELETE CASCADE,
  CONSTRAINT fk_perm_doctype FOREIGN KEY (doctype_id) REFERENCES sys_doctype(id) ON DELETE CASCADE
);
```

### Understanding `perm_level`

In modern ERP (like Frappe), you may want "Sales User" to be able to view the `Customer` document, but **not** be able to edit `credit_limit`. `perm_level` enables this.
- `perm_level = 0`: Standard authorization (Create, Read, Update, Delete on the entire document).
- `perm_level = 1`: Field level permission. "Sales User" might have perm_level 1 with `can_read = 1, can_write = 0` specifically for `restricted_fields: ["credit_limit"]`.
