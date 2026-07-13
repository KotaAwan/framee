# 00-05 Development Constitution

## Purpose

The Development Constitution defines the **rules, workflows, and standards** that govern how the Framee ERP Framework is developed, maintained, and evolved over time. It is the engineering team's social contract — establishing how code is written, reviewed, merged, tested, and deployed.

This document exists to prevent chaos as the team and codebase grow. Without a constitution, each developer brings their own conventions, leading to inconsistency, hidden bugs, and a codebase that becomes progressively harder to maintain.

---

## Goals

1. Establish a consistent, repeatable development workflow for all contributors.
2. Define code quality standards that all contributions must meet before merging.
3. Set the expectations for testing, documentation, and review at each development phase.
4. Define the branching strategy and release process.
5. Provide clear guidelines for database migrations, breaking API changes, and plugin API changes.

---

## Scope

### In Scope
- Development workflow (branching, commits, pull requests, code review)
- Code quality standards (linting, formatting, coverage thresholds)
- Testing requirements (unit, integration, API)
- Database migration process
- Release and versioning process
- Documentation requirements

### Out of Scope
- Cloud infrastructure provisioning (separate infrastructure runbook)
- Production monitoring and alerting configuration (separate ops runbook)
- Plugin certification process for marketplace submission (separate plugin governance doc)

---

## Functional Requirements

### FR-001 Code Review
- All code changes must go through a pull request (PR) with at least one approving review before merging.
- No developer may merge their own PR without at least one external approval, except for hotfixes with documented justification.

### FR-002 Automated Checks
- All PRs must pass automated linting, formatting, and test suites before merging is permitted.
- The CI pipeline must block merge if code coverage drops below the defined threshold.

### FR-003 Migration Safety
- Database migrations must be reviewed independently from application code in PRs.
- Migrations must be reversible (have a `down` function) unless a documented, justified exception is granted.

### FR-004 Versioning
- The framework uses Semantic Versioning (semver): `MAJOR.MINOR.PATCH`.
- Breaking changes to the core API or plugin API require a MAJOR version bump.

---

## Architecture

The development lifecycle follows a linear progression:

```
Feature Branch → Pull Request → CI Checks → Code Review → Merge → Staging Deploy → QA → Release
```

### Branch Structure

```
main                ← Production-ready code only. Protected branch.
develop             ← Integration branch for completed features.
feature/{name}      ← Individual feature branches (branch from develop)
fix/{name}          ← Bug fix branches (branch from develop or main for hotfixes)
release/{version}   ← Release preparation branches
hotfix/{name}       ← Emergency production fix (branch from main)
```

### Branch Rules

| Branch | Protected | Direct Push | Merge Via |
|--------|-----------|-------------|-----------|
| `main` | Yes | No | PR from `release/*` or `hotfix/*` only |
| `develop` | Yes | No | PR from `feature/*` or `fix/*` |
| `feature/*` | No | Yes (author) | — |
| `fix/*` | No | Yes (author) | — |
| `release/*` | Yes | No | PR from `develop` |
| `hotfix/*` | No | Yes (author) | PR to both `main` and `develop` |

---

## Database Design

_Not applicable. The Constitution is a governance document, not a data entity._

---

## API Design

_Not applicable._

---

## UI Behaviour

_Not applicable._

---

## Configuration

### CI/CD Pipeline Requirements

| Step | Tool | Required |
|------|------|----------|
| Lint | ESLint | Yes |
| Format Check | Prettier | Yes |
| Unit Tests | Jest | Yes |
| Integration Tests | Jest + Supertest | Yes |
| Coverage Report | Jest | Yes (must be ≥ 80%) |
| Build Check | Next.js build | Yes (frontend PRs) |
| Security Audit | `npm audit` | Yes (block on HIGH/CRITICAL) |
| Migration Check | Custom script | Yes (if migration files changed) |

### Code Quality Thresholds

| Metric | Threshold |
|--------|-----------|
| Statement coverage | ≥ 80% |
| Branch coverage | ≥ 75% |
| Function coverage | ≥ 80% |
| Max file length | 400 lines |
| Max function length | 50 lines |
| Max cyclomatic complexity | 10 |

---

## Validation Rules

### Commit Message Format

All commit messages must follow **Conventional Commits** format:

```
<type>(<scope>): <short description>

[optional body]

[optional footer]
```

**Types:**

| Type | Usage |
|------|-------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation change |
| `refactor` | Code refactor (no feature/fix) |
| `test` | Adding or modifying tests |
| `chore` | Build system, dependencies, config |
| `perf` | Performance improvement |
| `ci` | CI/CD changes |
| `db` | Database migration changes |

**Examples:**
```
feat(metadata-engine): add field validation hook support
fix(crud-engine): correct soft delete filter on list query
db(sys_doctype): add index on (tenant_id, name)
docs(prd): add 01-02 database engine PRD
```

### Pull Request Requirements

- PR title must follow Conventional Commits format.
- PR must include a description explaining **what** changed and **why**.
- PR must link to the relevant ticket or issue number.
- PR must include test coverage for all new or modified code paths.
- PR diff must not exceed 500 lines changed (excluding generated files). Large changes must be split.

### Code Review Standards

**Reviewer responsibilities:**

1. Verify the change solves the stated problem.
2. Check for Golden Rule violations (see `00-02-golden-rules.md`).
3. Verify that tests are meaningful and cover edge cases.
4. Check that error handling is explicit — no silent failures.
5. Verify that database queries are parameterized.
6. Check for missing documentation on public-facing APIs or engines.
7. Verify that event emissions are present for all data-mutating operations.

**Review turnaround SLA:** 24 hours on business days.

---

## Security

### Dependency Security
- `npm audit` runs on every CI build. HIGH and CRITICAL vulnerabilities block the merge.
- Dependencies must be reviewed and updated at minimum quarterly.
- No dependency with a known active exploit may be merged.

### Secret Handling
- No secrets, credentials, or API keys may be committed to the repository.
- All secrets are loaded from environment variables.
- `.env` files are in `.gitignore`. Pre-commit hooks must enforce this.

### Security Review
- Any PR that touches authentication, authorization, or tenant isolation middleware requires a security-focused review from a designated security reviewer.
- Changes to the Permission Engine require explicit sign-off from the lead architect.

---

## Events

_Not applicable for the Development Constitution._

---

## Performance

### Performance Baseline
- All API endpoint changes must be benchmarked before and after the change.
- If a change increases the P95 response time by more than 20%, it must be optimized before merging.

### Database Migration Performance
- Migrations that add indexes or modify large tables must include an estimated run time for tables with 1 million+ rows.
- Migrations that lock tables (e.g., `ALTER TABLE` without `ALGORITHM=INPLACE`) require a maintenance window.

---

## Development Standards

### Backend Standards

1. **No inline SQL** — All database queries go through the repository layer using the query builder.
2. **No `console.log`** — Use the Winston logger (`logger.info`, `logger.error`, `logger.debug`).
3. **Explicit error handling** — All async functions must have `try/catch` blocks. Unhandled promise rejections are forbidden.
4. **Standard response envelope** — All API responses must use `response.helper.js` to format responses.
5. **No fat controllers** — Route handlers must call service methods only. Maximum 10 lines in a route handler.
6. **Event emission** — All service methods that mutate data must emit the appropriate lifecycle events.

### Frontend Standards

1. **No hard-coded field definitions** — All form fields come from DocType metadata API.
2. **Loading states** — All data-fetching operations must render a loading state while pending.
3. **Error states** — All data-fetching operations must render a meaningful error state on failure.
4. **Accessibility** — All interactive elements must have `aria-label` or visible label. Tab order must be logical.
5. **No inline styles** — All styles go in CSS files. Inline style attributes are forbidden.
6. **Component naming** — PascalCase for components, camelCase for hooks and utilities.

### Database Migration Standards

1. **Numbered sequentially** — Migration files must be numbered with zero-padded 3-digit prefixes (e.g., `001_`, `002_`).
2. **Single responsibility** — Each migration file does one thing only.
3. **Reversible** — Every migration must have an `up()` and `down()` function.
4. **No data in schema migrations** — Schema migrations only. Data seeding goes in seed files.
5. **Tested locally** — Author must run `migrate:up` and `migrate:down` locally before committing.

---

## Versioning and Release Process

### Semantic Versioning

```
MAJOR.MINOR.PATCH

MAJOR: Breaking change to public API, plugin API, or database schema
MINOR: New backward-compatible features
PATCH: Bug fixes, performance improvements, documentation updates
```

### Release Process

```
1. Create release branch: release/1.2.0 from develop
2. Update CHANGELOG.md with all changes in this release
3. Update version in package.json (backend and frontend)
4. Run full test suite (must pass 100%)
5. Create PR from release branch to main
6. Require 2 approvals for release PRs
7. Merge to main
8. Tag: git tag v1.2.0
9. Merge main back to develop (to capture any release branch commits)
10. Deploy to production
```

### CHANGELOG Format

```markdown
## [1.2.0] - 2026-07-01

### Added
- feat(metadata-engine): hot reload support for DocType changes

### Changed
- refactor(crud-engine): extract filter builder into separate utility

### Fixed
- fix(permission-engine): field-level read check was skipping inherited roles

### Breaking Changes
- API: `/api/v1/doctype` renamed to `/api/v1/meta/doctype`
```

---

## Future Improvements

- **Pre-commit Hooks** — Husky + lint-staged to enforce linting and formatting before every commit locally.
- **Automated Changelog** — Use `conventional-changelog` to auto-generate CHANGELOG from commit messages.
- **Architecture Testing** — ArchUnit-style tests that enforce Clean Architecture layer boundaries automatically.
- **PR Size Bot** — Automated bot that blocks PRs exceeding 500 lines and suggests split strategies.
- **Security Scorecard** — OpenSSF Scorecard integration to continuously evaluate supply chain security.

---

## Acceptance Criteria

- [ ] The CI pipeline runs and passes on a clean branch with no changes.
- [ ] A commit with a non-compliant message is rejected by the commit-msg hook (when Husky is configured).
- [ ] A PR that reduces test coverage below 80% is blocked from merging by CI.
- [ ] A PR that introduces a HIGH severity npm audit vulnerability is blocked from merging.
- [ ] A database migration runs successfully with `migrate:up` and rolls back cleanly with `migrate:down`.
- [ ] The CHANGELOG is updated as part of every release PR.
- [ ] The `main` branch is protected — direct push is rejected.
- [ ] The `develop` branch is protected — direct push is rejected.

---

## Notes

- The Development Constitution applies to **all contributors**, including the founding team. No exceptions for "it's just a quick fix."
- This document must be reviewed at the start of each major framework release cycle and updated to reflect any process changes.
- When a new team member joins, they must read and acknowledge the Golden Rules (`00-02`) and this Development Constitution before their first PR is reviewed.
- AI agents generating code for Framee must be provided this document as context to ensure generated code follows the team's conventions.
