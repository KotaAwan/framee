# 11-02 CI/CD Pipeline

## Purpose

Documents the Continuous Integration and Continuous Deployment (CI/CD) strategy for Framee using GitHub Actions.

---

## 1. Branching Strategy

Framee follows a simplified Git Flow:
- `main`: Production-ready code. Commits here are automatically deployed to the Production environment.
- `develop`: Integration branch. Commits here are automatically deployed to the Staging environment.
- `feature/*`, `fix/*`, `chore/*`: Working branches. Must be merged into `develop` via Pull Request.

---

## 2. Continuous Integration (CI)

The CI pipeline runs on every push to a branch and every Pull Request.

### CI Workflow Steps (`.github/workflows/ci.yml`)

1. **Setup**: Checkout code, setup Node.js v20.
2. **Install**: Run `npm ci` (clean install).
3. **Linting**: Run `npm run lint`. Fails if there are ESLint or Prettier violations.
4. **Unit Tests**: Run `npm run test:unit`.
5. **Integration Tests**:
   - Starts a MySQL Docker service within the GitHub runner.
   - Runs `npm run migrate` on the test database.
   - Runs `npm run test:integration`.
6. **Coverage Check**: Ensure coverage meets minimum thresholds.

*Pull Requests cannot be merged into `develop` or `main` unless the CI pipeline passes.*

---

## 3. Continuous Deployment (CD)

The CD pipeline runs automatically when code is pushed to `develop` or `main`.

### CD Workflow Steps (`.github/workflows/cd.yml`)

1. **Wait for CI**: CD only triggers if CI passes.
2. **Build Docker Image**:
   - Builds a production-ready Docker image containing both Backend and Frontend.
   - Tags the image with the git commit SHA (e.g., `framee:abc1234`).
3. **Push to Registry**: Pushes the image to a Container Registry (e.g., AWS ECR, GitHub Packages).
4. **Deploy**:
   - Connects to the target server (via SSH or Kubernetes API).
   - Pulls the new Docker image.
   - Runs Database Migrations (`npm run migrate`).
   - Restarts the application gracefully (Zero Downtime Deployment).

### Environment Mapping
- Push to `develop` → Deploys to Staging.
- Push to `main` → Deploys to Production.

---

## 4. Database Migrations in CI/CD

Handling database migrations automatically requires care:
1. Migrations are run *before* the application server restarts to ensure the database schema matches the new code.
2. **Backwards Compatibility**: Migration scripts (and the code) must be designed so that the old version of the app can still run briefly while the new version starts up. Avoid dropping columns directly if the old code still reads them.
3. If a migration fails during the CD pipeline, the deployment halts, and the old version remains running.
