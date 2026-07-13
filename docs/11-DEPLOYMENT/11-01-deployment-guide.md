# 11-01 Deployment Guide

## Purpose

Documents how to deploy Framee to various environments — local development, staging, and production. Covers environment configuration, Docker setup, process management, and deployment checklist.

---

## 1. Environments

| Environment | Purpose | Database | Redis |
|-------------|---------|----------|-------|
| `development` | Local coding | `framee_dev` | Local Redis |
| `test` | Automated tests | `framee_test` | Local Redis (or mock) |
| `staging` | QA & demo | `framee_staging` | Staging Redis |
| `production` | Live system | `framee_prod` | Production Redis |

---

## 2. Environment Variables

All required environment variables:

```bash
# App
APP_ENV=production
APP_PORT=3001
APP_SECRET=your_app_secret_32_chars_minimum

# Database
DB_HOST=localhost
DB_PORT=3306
DB_NAME=framee_prod
DB_USER=framee_user
DB_PASSWORD=your_db_password
DB_POOL_MIN=2
DB_POOL_MAX=10

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# Auth
JWT_SECRET=your_jwt_secret_64_chars_minimum
JWT_EXPIRES_IN=3600
REFRESH_TOKEN_EXPIRES_DAYS=7

# CORS
CORS_ALLOWED_ORIGINS=https://app.yourcompany.com,https://admin.yourcompany.com

# Logging
LOG_LEVEL=info
LOG_FORMAT=json

# Audit
AUDIT_LOG_RETENTION_DAYS=365

# Queue
JOB_CONCURRENCY=5
COMMENT_EDIT_WINDOW_MINUTES=15
VERSION_MAX_KEEP=50

# Email (optional)
MAIL_HOST=smtp.sendgrid.net
MAIL_PORT=587
MAIL_USER=apikey
MAIL_PASSWORD=your_sendgrid_api_key
MAIL_FROM=no-reply@yourcompany.com
```

---

## 3. Docker Compose (Local Development)

```yaml
# docker-compose.yml
version: '3.8'
services:
  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: root
      MYSQL_DATABASE: framee_dev
      MYSQL_USER: framee_user
      MYSQL_PASSWORD: framee_password
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql

  redis:
    image: redis:8-alpine
    ports:
      - "6379:6379"
    command: redis-server --save 60 1

volumes:
  mysql_data:
```

Start with: `docker-compose up -d`

---

## 4. Initial Setup (First Deploy)

```bash
# 1. Clone repository
git clone https://github.com/your-org/framee.git
cd framee

# 2. Install dependencies
npm install

# 3. Copy environment file
cp .env.example .env
# Edit .env with your values

# 4. Run database migrations
npm run migrate

# 5. Run database seeds (initial data: System Manager role, default tenant)
npm run seed

# 6. Start the application
npm run start
```

---

## 5. Process Management (PM2)

For production, use **PM2** for process management and auto-restart.

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'framee-api',
      script: 'apps/backend/src/server.js',
      instances: 'max',   // Use all CPU cores
      exec_mode: 'cluster',
      max_memory_restart: '1G',
      env_production: {
        APP_ENV: 'production',
        NODE_ENV: 'production'
      }
    },
    {
      name: 'framee-worker',
      script: 'apps/backend/src/worker.js',
      instances: 2,
      exec_mode: 'fork',
      env_production: {
        APP_ENV: 'production'
      }
    }
  ]
};
```

Start: `pm2 start ecosystem.config.js --env production`

---

## 6. Deployment Checklist

### Before Deploy
- [ ] All tests pass in CI (`npm run test:coverage`).
- [ ] No `.env` file committed to the repository.
- [ ] Database backup created for `framee_prod`.
- [ ] Migrations reviewed — all have a valid `down()` rollback function.

### Deploy Steps
1. Pull latest code: `git pull origin main`
2. Install dependencies: `npm install --production`
3. Run migrations: `npm run migrate`
4. Restart API: `pm2 reload framee-api`
5. Restart Worker: `pm2 reload framee-worker`

### After Deploy
- [ ] `GET /api/v1/health` returns `200 OK`.
- [ ] Login works with a test account.
- [ ] Check PM2 logs for any errors: `pm2 logs framee-api --lines 100`
- [ ] Monitor Redis connection: `redis-cli ping` → `PONG`

---

## 7. Health Check Endpoint

### GET `/api/v1/health`

Returns the health status of the application. Used by load balancers and monitoring tools.

**Response `200 OK` (healthy):**
```json
{
  "status": "ok",
  "timestamp": "2026-07-13T10:00:00Z",
  "services": {
    "database": "ok",
    "redis": "ok",
    "queue": "ok"
  },
  "version": "1.0.0"
}
```

**Response `503 Service Unavailable` (unhealthy):**
```json
{
  "status": "degraded",
  "services": {
    "database": "ok",
    "redis": "error",
    "queue": "error"
  }
}
```
