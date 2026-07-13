# 05-05 Workflow Tables

## Purpose

Documents the schema for tables that support the configuration and history of document status transitions (Workflow Engine).

---

## 1. Overview

Not all DocTypes use a custom Workflow. By default, DocTypes with `is_submittable = 1` only use standard status transitions (`Draft -> Submitted -> Locked`).
If a DocType requires a multi-tier Approval Flow (e.g., `Draft -> Pending Manager -> Pending Director -> Approved`), this feature is configured through the Workflow tables.

---

## 2. Table: `sys_workflow`

The primary workflow configuration for a DocType.

```sql
CREATE TABLE sys_workflow (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  
  name VARCHAR(100) NOT NULL,           -- e.g., 'PO Approval Flow'
  doctype_id VARCHAR(36) NOT NULL,      -- FK to sys_doctype (e.g., Purchase Order)
  is_active TINYINT(1) DEFAULT 1,
  
  -- Override default status (optional)
  override_status TINYINT(1) DEFAULT 1, -- If true, the 'status' column follows workflow state
  
  status VARCHAR(20) DEFAULT 'Active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE KEY uniq_workflow_doctype (tenant_id, doctype_id)
);
```

---

## 3. Table: `sys_workflow_state`

Defines the nodes (states/statuses) in a workflow.

```sql
CREATE TABLE sys_workflow_state (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  
  workflow_id VARCHAR(36) NOT NULL,
  state VARCHAR(50) NOT NULL,           -- e.g., 'Pending Manager'
  
  -- Metadata related to UI/standard status
  doc_status VARCHAR(20) NOT NULL,      -- Maps to standard status: 'Draft', 'Submitted', etc.
  allow_edit TINYINT(1) DEFAULT 0,      -- Can the document be edited in this state?
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE KEY uniq_wf_state (tenant_id, workflow_id, state),
  CONSTRAINT fk_wfs_wf FOREIGN KEY (workflow_id) REFERENCES sys_workflow(id) ON DELETE CASCADE
);
```

---

## 4. Table: `sys_workflow_transition`

Defines the edges (arrows) for state transitions, and which Role is authorized to execute them.

```sql
CREATE TABLE sys_workflow_transition (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  
  workflow_id VARCHAR(36) NOT NULL,
  
  state_from VARCHAR(50) NOT NULL,      -- e.g., 'Draft'
  state_to VARCHAR(50) NOT NULL,        -- e.g., 'Pending Manager'
  
  action VARCHAR(50) NOT NULL,          -- UI button label (e.g., 'Request Approval')
  allowed_role_id VARCHAR(36) NOT NULL, -- FK to sys_role. Who can press this button?
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE KEY uniq_wf_trans (tenant_id, workflow_id, state_from, action),
  CONSTRAINT fk_wft_wf FOREIGN KEY (workflow_id) REFERENCES sys_workflow(id) ON DELETE CASCADE,
  CONSTRAINT fk_wft_role FOREIGN KEY (allowed_role_id) REFERENCES sys_role(id)
);
```

---

## 5. Table: `sys_workflow_history`

Records the approval trail for tracking purposes. This is different from the Audit Log — it focuses on the approval flow (who approved, and their comment).

```sql
CREATE TABLE sys_workflow_history (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  
  doctype VARCHAR(100) NOT NULL,
  doc_id VARCHAR(36) NOT NULL,
  
  action VARCHAR(50) NOT NULL,          -- Action taken
  state_from VARCHAR(50) NOT NULL,
  state_to VARCHAR(50) NOT NULL,
  
  user_id VARCHAR(36) NOT NULL,         -- Who executed the action
  comment TEXT NULL,                    -- Approval / rejection reason
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  -- No updated_at, as this log is immutable
);
```

### Relationship with Actual Data
When `dt_purchase_order` has a workflow attached, upon saving a document, the CRUD Engine will:
1. Read `sys_workflow_state` for the initial state (typically mapping to `doc_status = 'Draft'`).
2. Store that state value in the `workflow_state` column of `dt_purchase_order`.
3. Subsequent transition validation reads `sys_workflow_transition` based on `state_from == doc.workflow_state`.
