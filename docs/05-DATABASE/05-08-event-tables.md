# 05-08 Event Tables

## Purpose

Documents the tables that support the Event and Queue systems. Not all events require database persistence, but events that carry a failure risk (such as email notifications or webhooks) need to be recorded so they can be retried.

---

## 1. Overview

In Framee's Event-Driven Architecture (see `04-13-event-flow.md`), most events are in-memory (Node.js EventEmitter). However, for events that **must be delivered** (at-least-once guarantee), jobs need to be persisted.

Redis (BullMQ) is the primary queue engine. The `sys_job_log` table in MySQL serves as the **Dead Letter Queue (DLQ)** and **audit trail for background jobs**.

---

## 2. Table: `sys_job_log`

Records the execution results of background jobs — especially jobs that **fail** after all retry attempts are exhausted (Dead Letter).

```sql
CREATE TABLE sys_job_log (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NULL,           -- NULL if global/system job
  
  queue_name VARCHAR(100) NOT NULL,     -- e.g., 'framee:q:email'
  job_name VARCHAR(100) NOT NULL,       -- e.g., 'sendSubmitNotification'
  job_id VARCHAR(255) NULL,             -- ID from BullMQ
  
  payload JSON NOT NULL,                -- Job input data
  
  status VARCHAR(20) NOT NULL,          -- 'pending', 'completed', 'failed'
  attempts INT DEFAULT 0,              -- How many times it has been tried
  last_error TEXT NULL,                 -- Last error message
  
  queued_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  started_at DATETIME NULL,
  completed_at DATETIME NULL,
  failed_at DATETIME NULL,
  
  INDEX idx_job_status (status, queued_at),
  INDEX idx_job_tenant (tenant_id, status),
  INDEX idx_job_queue (queue_name, status)
);
```

**When is a Row Created?**
- When a job succeeds: (optional, only if `AUDIT_JOB_SUCCESS = true`).
- When a job **fails completely** (exhausts all retries): **Required**.

**Who Reads It?**
- Admin can view the list of failed jobs on the Admin → Job Monitor page.
- Admin can re-trigger failed jobs from the UI.

---

## 3. Table: `sys_webhook`

Configuration for webhooks to be called when a specific event occurs on a DocType.

```sql
CREATE TABLE sys_webhook (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  
  name VARCHAR(100) NOT NULL,           -- e.g., 'Notify ERP on Invoice Submit'
  
  doctype_id VARCHAR(36) NOT NULL,      -- FK to sys_doctype
  event VARCHAR(50) NOT NULL,           -- e.g., 'submitted', 'after_insert'
  
  webhook_url TEXT NOT NULL,            -- Target endpoint URL
  
  request_method VARCHAR(10) DEFAULT 'POST',
  headers JSON NULL,                    -- Custom request headers (e.g., API Key)
  
  is_active TINYINT(1) DEFAULT 1,
  
  status VARCHAR(20) DEFAULT 'Active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_webhook_doctype FOREIGN KEY (doctype_id) REFERENCES sys_doctype(id) ON DELETE CASCADE
);
```

---

## 4. Table: `sys_webhook_log`

Records every webhook delivery attempt for debugging and monitoring.

```sql
CREATE TABLE sys_webhook_log (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  
  webhook_id VARCHAR(36) NOT NULL,      -- FK to sys_webhook
  doc_id VARCHAR(36) NULL,              -- Document that triggered the webhook
  
  request_payload JSON NULL,            -- Body sent
  response_code INT NULL,               -- HTTP status code from target
  response_body TEXT NULL,
  
  status VARCHAR(20) NOT NULL,          -- 'success', 'failed'
  error_message TEXT NULL,
  duration_ms INT NULL,                 -- Latency in milliseconds
  
  sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_wl_webhook (webhook_id, sent_at),
  INDEX idx_wl_status (tenant_id, status, sent_at)
);
```
