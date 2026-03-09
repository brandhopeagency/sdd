# Quickstart: Monorepo Split Migration

**Feature**: 001-monorepo-split
**Date**: 2026-02-04

## Prerequisites

Before starting the migration, ensure:

- [ ] Access to MentalHelpGlobal GitHub organization with admin permissions
- [ ] GitHub CLI (`gh`) installed and authenticated
- [ ] `git-filter-repo` installed (`pip install git-filter-repo`)
- [ ] Node.js 20 LTS installed
- [ ] GCP credentials configured for Cloud Run and GCS access
- [ ] All tests passing on current monorepo (`main` branch)

---

## Phase 0: Repository Setup

### Step 1: Create New Repositories

```bash
# Navigate to organization root
cd /path/to/workspace

# Create repositories (private by default)
gh repo create MentalHelpGlobal/chat-backend --private --description "Express.js API server"
gh repo create MentalHelpGlobal/chat-frontend --private --description "React/Vite SPA"
gh repo create MentalHelpGlobal/chat-ui --private --description "Playwright E2E tests"
gh repo create MentalHelpGlobal/chat-infra --private --description "Infrastructure as Code"
gh repo create MentalHelpGlobal/chat-ci --private --description "Reusable CI/CD workflows"
gh repo create MentalHelpGlobal/chat-types --private --description "Shared TypeScript types"
```

### Step 2: Configure Repository Settings

For each repository, configure:

```bash
REPO="chat-backend"  # Repeat for each repo

# Enable branch protection
gh api repos/MentalHelpGlobal/$REPO/branches/main/protection -X PUT \
  -f required_status_checks='{"strict":true,"contexts":["test"]}' \
  -f enforce_admins=true \
  -f required_pull_request_reviews='{"required_approving_review_count":1}'

# Create develop branch
gh api repos/MentalHelpGlobal/$REPO/git/refs -X POST \
  -f ref="refs/heads/develop" \
  -f sha="$(gh api repos/MentalHelpGlobal/$REPO/git/refs/heads/main -q .object.sha)"
```

### Step 3: Configure GitHub Packages

```bash
# Enable GitHub Packages for organization
# (This is typically done via GitHub UI: Organization Settings → Packages)

# Configure npm authentication for CI
# Add to each repo's secrets: GITHUB_TOKEN (automatic) handles this
```

---

## Phase 1: Shared Types Package

### Step 1: Initialize chat-types Repository

```bash
git clone https://github.com/MentalHelpGlobal/chat-types.git
cd chat-types

# Initialize package
npm init -y

# Update package.json with proper configuration
cat > package.json << 'EOF'
{
  "name": "@mhg/chat-types",
  "version": "1.0.0",
  "description": "Shared TypeScript types for MHG chat applications",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist"],
  "scripts": {
    "build": "tsc",
    "prepublishOnly": "npm run build"
  },
  "publishConfig": {
    "registry": "https://npm.pkg.github.com"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/MentalHelpGlobal/chat-types.git"
  },
  "devDependencies": {
    "typescript": "^5.6.0"
  }
}
EOF

# Add TypeScript config
cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true
  },
  "include": ["src/**/*"]
}
EOF

# Create source directory
mkdir -p src
```

### Step 2: Extract Types from Monorepo

```bash
# Copy types from monorepo (adjust path as needed)
MONOREPO="/d/src/MHG/chat-client"

# Create type files from existing sources
cp "$MONOREPO/src/types/index.ts" src/entities.ts
cp "$MONOREPO/src/types/conversation.ts" src/conversation.ts
cp "$MONOREPO/src/types/agentMemory.ts" src/agentMemory.ts

# Extract RBAC types to separate file
# (Manual step: split rbac types from entities.ts into rbac.ts)

# Create index.ts re-exports
cat > src/index.ts << 'EOF'
export * from './rbac';
export * from './entities';
export * from './conversation';
export * from './agentMemory';
EOF
```

### Step 3: Publish Initial Version

```bash
# Build
npm install
npm run build

# Commit
git add .
git commit -m "feat: initial shared types package"
git push origin main

# Tag and publish
git tag v1.0.0
git push origin v1.0.0

# Verify publication
npm view @mhg/chat-types --registry=https://npm.pkg.github.com
```

---

## Phase 2: Repository Population

### Step 1: Clone Fresh Copies

```bash
# Clone fresh copy for each split
git clone https://github.com/MentalHelpGlobal/chat-client.git chat-backend-source
git clone https://github.com/MentalHelpGlobal/chat-client.git chat-frontend-source
git clone https://github.com/MentalHelpGlobal/chat-client.git chat-ui-source
```

### Step 2: Filter Backend Repository

```bash
cd chat-backend-source

# Filter to keep only server/ directory
git filter-repo --path server/ --path-rename server/:

# Add .npmrc for GitHub Packages
cat > .npmrc << 'EOF'
@mhg:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
EOF

# Update package.json to use shared types
# (Manual step: replace local type imports with @mhg/chat-types)

# Remove duplicate types directory if exists
rm -rf src/types

# Add remote and push
git remote set-url origin https://github.com/MentalHelpGlobal/chat-backend.git
git push -u origin main --force

cd ..
```

### Step 3: Filter Frontend Repository

```bash
cd chat-frontend-source

# Filter to keep frontend files
git filter-repo \
  --path src/ \
  --path public/ \
  --path index.html \
  --path package.json \
  --path package-lock.json \
  --path tsconfig.json \
  --path vite.config.ts \
  --path vitest.config.ts \
  --path tailwind.config.js \
  --path postcss.config.js \
  --path eslint.config.js \
  --path Dockerfile.test.fe

# Add .npmrc
cat > .npmrc << 'EOF'
@mhg:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
EOF

# Update to use shared types
# Remove src/types/ and update imports

git remote set-url origin https://github.com/MentalHelpGlobal/chat-frontend.git
git push -u origin main --force

cd ..
```

### Step 4: Filter UI Test Repository

```bash
cd chat-ui-source

# Filter to keep E2E tests
git filter-repo \
  --path tests/e2e/ \
  --path playwright.config.ts \
  --path-rename tests/e2e/:tests/

# Add MCP configuration
cat > .mcp.json << 'EOF'
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest"],
      "timeout": 30000,
      "type": "stdio"
    }
  }
}
EOF

# Create package.json for standalone E2E project
cat > package.json << 'EOF'
{
  "name": "@mhg/chat-ui",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "test": "playwright test",
    "test:headed": "playwright test --headed"
  },
  "devDependencies": {
    "@playwright/test": "^1.57.0"
  }
}
EOF

git remote set-url origin https://github.com/MentalHelpGlobal/chat-ui.git
git push -u origin main --force

cd ..
```

### Step 5: Setup Infrastructure Repository

```bash
git clone https://github.com/MentalHelpGlobal/chat-infra.git
cd chat-infra

# Copy infra scripts from monorepo
cp -r "$MONOREPO/infra/"* .

# Create structure for future Terraform
mkdir -p terraform/environments/{dev,staging,prod}
mkdir -p terraform/modules

git add .
git commit -m "feat: initial infrastructure setup"
git push origin main

cd ..
```

### Step 6: Setup CI Repository

```bash
git clone https://github.com/MentalHelpGlobal/chat-ci.git
cd chat-ci

mkdir -p .github/workflows

# Create reusable workflows (see contracts/ci-workflows.md for full content)
# ... create workflow files ...

git add .
git commit -m "feat: reusable CI/CD workflows"
git push origin main
git tag v1.0.0
git push origin v1.0.0

cd ..
```

---

## Phase 3: CI/CD Configuration

### Step 1: Add Workflow Files to Each Repository

**chat-backend/.github/workflows/ci.yml**:
```yaml
name: CI
on: [push, pull_request]

jobs:
  test:
    uses: MentalHelpGlobal/chat-ci/.github/workflows/test-backend.yml@v1
    secrets: inherit

  deploy:
    if: github.ref == 'refs/heads/main' || github.ref == 'refs/heads/develop'
    needs: test
    uses: MentalHelpGlobal/chat-ci/.github/workflows/deploy-backend.yml@v1
    with:
      environment: ${{ github.ref == 'refs/heads/main' && 'prod' || 'dev' }}
      service-name: ${{ github.ref == 'refs/heads/main' && 'chat-backend' || 'chat-backend-dev' }}
    secrets: inherit
```

### Step 2: Configure Repository Secrets

For each application repository, add these secrets:

```
GCP_PROJECT_ID       - Google Cloud project ID
GCP_SA_KEY           - Service account key JSON
DIALOGFLOW_*         - Dialogflow configuration
DATABASE_URL         - PostgreSQL connection string
JWT_SECRET           - JWT signing secret
```

### Step 3: Validate CI/CD

```bash
# Create test branch and PR to validate workflows
cd chat-backend
git checkout -b test/ci-validation
echo "# Test" >> README.md
git add . && git commit -m "test: validate CI workflow"
git push -u origin test/ci-validation
gh pr create --title "Test CI Workflow" --body "Validation PR"
```

---

## Phase 4: Parallel Operation

### Step 1: Deploy Split Repositories (Non-Production)

```bash
# Deploy to dev environment
cd chat-backend
git checkout develop
git push origin develop  # Triggers dev deployment

cd ../chat-frontend
git checkout develop
git push origin develop  # Triggers dev deployment
```

### Step 2: Run E2E Validation

```bash
cd chat-ui

# Run against new deployments
PLAYWRIGHT_BASE_URL=https://storage.googleapis.com/mhg-dev-frontend/index.html \
npx playwright test
```

### Step 3: Monitor During Parallel Period

- Compare error rates between old and new deployments
- Monitor latency differences
- Check for any missing functionality
- Run full E2E suite daily

---

## Phase 5: Cutover

### Step 1: Production Deployment

```bash
# After validation period (recommended: 1-2 weeks)

# Deploy backend to production
cd chat-backend
git checkout main
git merge develop
git push origin main

# Deploy frontend to production
cd chat-frontend
git checkout main
git merge develop
git push origin main
```

### Step 2: Archive Monorepo

```bash
# Archive original repository
gh repo archive MentalHelpGlobal/chat-client --yes

# Update README to point to new repositories
```

### Step 3: Update Documentation

- Update all onboarding docs
- Update AGENTS.md references
- Update this spec's constitution.md repository roles

---

## Verification Checklist

### Per-Repository Checks

- [ ] Repository cloneable
- [ ] `npm install` succeeds
- [ ] `npm test` passes
- [ ] CI workflow triggers on push
- [ ] Deployment succeeds

### Integration Checks

- [ ] Frontend can call backend API
- [ ] Shared types imported correctly
- [ ] E2E tests pass against deployed environment
- [ ] Health check endpoints respond

### Rollback Readiness

- [ ] Monorepo still deployable (during parallel period)
- [ ] Traffic can be switched back
- [ ] Documentation includes rollback steps

---

## Troubleshooting

### GitHub Packages Authentication

```bash
# If npm install fails for @mhg/* packages:
# 1. Ensure GITHUB_TOKEN is set
export GITHUB_TOKEN=$(gh auth token)

# 2. Verify .npmrc configuration
cat .npmrc  # Should have @mhg registry

# 3. Test authentication
npm whoami --registry=https://npm.pkg.github.com
```

### git-filter-repo Issues

```bash
# If filter-repo reports "fresh clone" error:
git filter-repo --force  # Use with caution

# To preview what will be kept:
git filter-repo --path server/ --dry-run
```

### Workflow Not Found

```bash
# If workflow_call reference fails:
# 1. Ensure chat-ci repo is accessible
gh repo view MentalHelpGlobal/chat-ci

# 2. Verify tag exists
gh release list -R MentalHelpGlobal/chat-ci

# 3. Check workflow file exists
gh api repos/MentalHelpGlobal/chat-ci/contents/.github/workflows
```
