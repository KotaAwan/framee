# 05-07 Cache Tables

## Purpose

Documents the tables related to session management, authentication tokens, and cache tracking at the database level. Although most caching is done in Redis (see `04-11-cache-strategy.md`), these tables store data that requires longer persistence or needs to be queried relationally.

---

## 1. Overview

Framee's strategy for caching tokens/sessions:
- **Redis** → Active JWT tokens, rate limit counters, metadata. Fast, TTL-based, volatile.
- **Database** → Refresh Tokens, Revoked Token Registry. Persistent, auditable.

---

## 2. Table: `sys_refresh_token`

Stores Refresh Tokens issued at login. JWT access tokens are short-lived (1 hour), while Refresh Tokens live longer (7 days) to obtain a new JWT without requiring the user to log in again.

```sql
CREATE TABLE sys_refresh_token (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  
  user_id VARCHAR(36) NOT NULL,         -- FK to sys_user.id
  
  token_hash VARCHAR(255) NOT NULL,     -- SHA-256 hash of the refresh token (not the raw token!)
  device_info TEXT NULL,                -- User-Agent / device name when token was created
  ip_address VARCHAR(45) NULL,
  
  expires_at DATETIME NOT NULL,         -- When the token expires
  revoked_at DATETIME NULL,             -- NULL = still valid
  revoked_reason VARCHAR(100) NULL,     -- 'logout', 'security_revoke', etc.
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_rt_user (tenant_id, user_id, expires_at),
  INDEX idx_rt_hash (token_hash),
  CONSTRAINT fk_rt_user FOREIGN KEY (user_id) REFERENCES sys_user(id) ON DELETE CASCADE
);
```

**Security Notes:**
- The raw token is **never** stored in the database. Only its hash (SHA-256 or Bcrypt) is stored.
- When a user logs out, `revoked_at` is set (soft-revoke), not deleted. This is for audit purposes.

---

## 3. Table: `sys_setting`

Stores system-level configuration per tenant, cacheable in Redis. Acts like a key-value store for application configuration.

```sql
CREATE TABLE sys_setting (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  
  setting_key VARCHAR(100) NOT NULL,    -- e.g., 'SMTP_HOST', 'DEFAULT_CURRENCY'
  setting_value TEXT NULL,
  value_type VARCHAR(20) DEFAULT 'string', -- string, int, bool, json
  
  description TEXT NULL,
  is_system TINYINT(1) DEFAULT 0,       -- System setting (not editable via standard UI)
  is_encrypted TINYINT(1) DEFAULT 0,    -- If true, value is stored encrypted
  
  status VARCHAR(20) DEFAULT 'Active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE KEY uniq_setting_key (tenant_id, setting_key)
);
```

**Caching Strategy for `sys_setting`:**
- At startup, all settings for a tenant are loaded from DB to Redis with key `framee:tenant:{id}:settings`.
- Redis TTL: 1 hour.
- When a setting is changed, the Redis key is invalidated.

---

## 4. Table: `sys_migration`

Tracks database migrations that have been executed, similar to Knex's built-in migrations tracker.

```sql
CREATE TABLE sys_migration (
  id VARCHAR(36) PRIMARY KEY,
  
  migration_name VARCHAR(255) NOT NULL UNIQUE, -- e.g., '20260713_create_sys_user'
  batch INT NOT NULL,                          -- Batch number (for rollback)
  executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
  
  -- No tenant_id because this is an infrastructure table
);
```
