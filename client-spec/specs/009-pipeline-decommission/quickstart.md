# CI Quickstart: Setting Up a New Repository

**Feature**: 009-pipeline-decommission  
**Purpose**: Guide for setting up CI/CD in a new repository that depends on `@mentalhelpglobal/chat-types`

## Prerequisites

1. **GitHub repository** in the `MentalHelpGlobal` organization
2. **PKG_TOKEN secret** configured in the repo with `repo` + `read:packages` scopes
3. **`.npmrc`** in the repo root:
   ```
   @mentalhelpglobal:registry=https://npm.pkg.github.com
   //npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
   ```
4. **`package.json`** with the chat-types dependency:
   ```json
   "@mentalhelpglobal/chat-types": "file:../chat-types"
   ```

## Step 1: CI Workflow Setup

Create `.github/workflows/ci.yml` with the standard pattern:

```yaml
name: CI
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # --- chat-types resolution (copy this block) ---
      - uses: actions/checkout@v4
        with:
          repository: MentalHelpGlobal/chat-types
          path: chat-types
          token: ${{ secrets.PKG_TOKEN }}
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://npm.pkg.github.com'
      - name: Build chat-types locally
        run: cd chat-types && npm install && npm run build
      - name: Install dependencies
        run: |
          npm pkg set "dependencies.@mentalhelpglobal/chat-types=file:./chat-types"
          npm install
        env:
          NODE_AUTH_TOKEN: ${{ secrets.PKG_TOKEN }}
          GITHUB_TOKEN: ${{ secrets.PKG_TOKEN }}
      # --- end chat-types block ---

      - name: Lint
        run: npx eslint --ignore-pattern 'chat-types/**' .
      - name: Test
        run: npm run test
      - name: Build
        run: npm run build
```

## Step 2: Vite Configuration (Frontend Only)

If the project uses Vite, add CJS interop config to `vite.config.ts`:

```typescript
export default defineConfig({
  // ... existing config ...
  build: {
    commonjsOptions: {
      include: [/chat-types/, /node_modules/],
    },
  },
})
```

## Step 3: Docker Configuration (Backend Only)

If the project builds a Docker image, update the Dockerfile:

```dockerfile
# In the builder stage — BEFORE npm install:
COPY chat-types/ ./chat-types/
RUN npm install  # not npm ci — lockfile was modified

# In the production stage:
COPY --from=builder /app/chat-types ./chat-types
```

## Step 4: GCP Secret Validation (Deploy Jobs Only)

If the deploy job references GCP secrets via `--set-secrets`, add a pre-flight check:

```yaml
- name: Validate GCP secrets
  run: |
    SECRETS="database-url jwt-secret jwt-refresh-secret gmail-client-secret gmail-refresh-token"
    for secret in $SECRETS; do
      COUNT=$(gcloud secrets versions list "$secret" --project="${{ vars.GCP_PROJECT_ID }}" \
        --filter="state=ENABLED" --format="value(name)" 2>/dev/null | wc -l)
      if [ "$COUNT" -eq 0 ]; then
        echo "::error::Secret '$secret' has no active versions"
        exit 1
      fi
    done
    echo "All secrets validated"
```

## Step 5: Coverage Thresholds

If the project uses Vitest with coverage thresholds in `vitest.config.ts`:

- Set initial thresholds to match current coverage levels
- When merging a PR that adds > 500 LOC of untested code, update thresholds in the same PR
- Add a comment in `vitest.config.ts` documenting the reason for threshold changes

Example:
```typescript
thresholds: {
  // Lowered after review feature merge (009-pipeline-decommission). Increment as tests are added.
  statements: 20,
  branches: 10,
  functions: 15,
  lines: 20,
},
```

## Repository Reference

| Repository | CI Status | chat-types? | Deploy Target |
|------------|-----------|-------------|---------------|
| chat-frontend | Active (test + deploy-dev) | Yes | GCS bucket |
| chat-backend | Active (test + deploy-dev) | Yes | Cloud Run |
| chat-ui | Active (E2E on dispatch/workflow_run) | No | N/A (test runner) |
| chat-client | **No CI** (local scripts only) | N/A | **None** |
