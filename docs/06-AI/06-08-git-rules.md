# 06-08 Git Rules

## Purpose

Rules for using Git in the Framee repository. These rules ensure a clean, readable commit history where every change can be traced back to a specific business or technical decision.

---

## 1. Branch Strategy

Framee uses a simplified **Git Flow**:

```
main          ← Production (always stable)
  └── develop ← Development trunk (all features integrate here)
       ├── feature/metadata-engine
       ├── feature/crud-engine
       ├── fix/audit-log-tenant-scope
       └── docs/update-database-phase
```

### Branch Rules

| Branch | Who pushes? | Rules |
|--------|-------------|-------|
| `main` | Only via PR from `develop` | No direct push |
| `develop` | Only via PR from feature branch | No direct push |
| `feature/*` | Developer/AI | Create from `develop`, merge into `develop` |
| `fix/*` | Developer/AI | Create from `develop` (or `main` for hotfix) |
| `docs/*` | Developer/AI | Create from `develop` |
| `db/*` | Developer/AI | Dedicated to database schema changes |

---

## 2. Commit Message Format

Format: `type(scope): short description (max 72 characters)`

Body (optional, when additional explanation is needed):
```
type(scope): brief summary

Why was this change made? What was the problem?
What is the impact? What can be rolled back?
```

### Allowed Types

| Type | When |
|------|------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation changes only |
| `refactor` | Refactor with no functional change |
| `test` | Adding or fixing tests |
| `chore` | Dependency update, configuration |
| `db` | Database migration |
| `perf` | Performance optimization |

### Scopes in Use

`metadata`, `crud`, `api`, `auth`, `permission`, `workflow`, `lifecycle`, `audit`, `version`, `cache`, `event`, `queue`, `ui`, `form`, `list`, `layout`, `docs`, `config`

### Example of a Good Commit Message

```
feat(metadata): implement two-tier cache for DocType schema

In-memory Map as L1 cache, Redis as L2.
Cache invalidation uses Redis Pub/Sub to notify all pods.
Falls back gracefully to DB if Redis is unavailable.

Closes #42
```

```
fix(crud): add tenant_id to all dt_* update queries
```

```
db(user): add last_login and failed_login_count columns to sys_user
```

---

## 3. Commit Rules

1. **One commit, one change**. Do not combine a bug fix + new feature in one commit.
2. **Commit messages in English** — international standard.
3. **Do not commit unnecessary files**: `.env`, `node_modules/`, `*.log`, build files.
4. **Only commit tested code** — do not commit code with debugging `console.log` or syntax errors.
5. **Atomic commits** — each commit must be in a state where it can be built and run successfully.

---

## 4. Standard `.gitignore`

Ensure these files are always in `.gitignore`:

```
# Dependencies
node_modules/

# Environment
.env
.env.local
.env.*.local

# Build output
.next/
dist/
build/

# Logs
*.log
logs/

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/settings.json
.idea/
```

---

## 5. Pull Request (PR) Rules

1. PRs must have a **descriptive title** (same format as the commit message).
2. PRs must include a **description** of what changed and why.
3. Every PR **must be reviewed** before merging into `develop` (at minimum a self-review for solo projects).
4. No "Work in Progress" PRs may be merged into `develop`.
5. Ensure all tests pass before merging.

---

## 6. Tags & Releases

Tag format: `v{major}.{minor}.{patch}`

- `v0.1.0` — Foundation (Database Engine + Metadata Engine complete)
- `v0.2.0` — CRUD + API Engine complete
- `v0.5.0` — Authentication + Permission Engine complete
- `v1.0.0` — Dynamic Form + Dynamic List production-ready
