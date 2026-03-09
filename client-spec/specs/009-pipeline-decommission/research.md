# Research: Pipeline Decommission & CI Consolidation

**Feature**: 009-pipeline-decommission  
**Date**: 2026-02-10

## Decision Log

### R-001: chat-types Dependency Resolution in CI

**Decision**: Check out and build chat-types locally in each CI job before `npm install`.

**Rationale**: The `file:../chat-types` dependency in `package.json` is designed for local development (sibling directories). In CI, the runner only has the target repo. The `npm pkg set` + `npm install` approach overrides the path at runtime without modifying the committed `package.json`.

**Alternatives considered**:
- **Publish chat-types to registry only**: Would require removing `file:` deps from package.json, breaking local dev workflow where developers keep chat-types as a sibling directory.
- **Git submodules**: Adds complexity and requires special handling in CI. Rejected.
- **Monorepo (Turborepo/Nx)**: Overkill for the current repo count. Rejected.
- **Pin to published version in CI**: Introduces drift between local (file:) and CI (registry) versions. Rejected.

**Pattern** (already implemented in chat-backend `2d9ce9d` and chat-frontend PR #9):
```yaml
- uses: actions/checkout@v4
  with:
    repository: MentalHelpGlobal/chat-types
    path: chat-types
    token: ${{ secrets.PKG_TOKEN }}
- name: Build chat-types locally
  run: cd chat-types && npm install && npm run build
- name: Install dependencies
  run: |
    npm pkg set "dependencies.@mentalhelpglobal/chat-types=file:./chat-types"
    npm install
```

---

### R-002: CJS/ESM Interop for Vite Frontends

**Decision**: Add `build.commonjsOptions.include` to `vite.config.ts` for any CJS file: dependency.

**Rationale**: Vite uses Rollup for production builds. Rollup's `@rollup/plugin-commonjs` transforms CJS to ESM but only covers `node_modules/` by default. The `file:./chat-types` dependency resolves outside the standard path, so Rollup doesn't apply the CJS transform.

**Alternatives considered**:
- **Migrate chat-types to ESM**: Would fix the frontend but break the CJS backend (`chat-backend` uses `"type": "commonjs"`). Dual CJS/ESM build is a larger effort, out of scope.
- **Use `import * as` pattern**: Fragile — doesn't work with tree-shaking and requires changes to every import site.
- **Vite `optimizeDeps.include`**: Only applies to dev server pre-bundling, not production builds. Insufficient.

**Pattern** (already applied in chat-frontend `452c9e1`):
```typescript
// vite.config.ts
build: {
  commonjsOptions: {
    include: [/chat-types/, /node_modules/],
  },
},
```

---

### R-003: GCP Secret Pre-flight Validation

**Decision**: Add a shell script step in the deploy-dev job that validates all `--set-secrets` references before `gcloud run deploy`.

**Rationale**: Cloud Run references secrets by name:latest. If a secret has no versions, the deploy succeeds (image push) but the revision fails to start. A pre-flight check catches this earlier with a clear error message.

**Alternatives considered**:
- **Terraform-managed secrets**: Proper but requires migrating all secrets to Terraform state. Separate effort.
- **Startup health check with retry**: Cloud Run already does this, but the error message is opaque ("container failed to start"). Pre-flight is more informative.
- **Secret creation automation**: Overkill — secrets are rarely added. Manual creation with validation is sufficient.

**Pattern** (new — to be implemented):
```bash
# Extract secret names from the gcloud run deploy command
SECRETS="database-url jwt-secret jwt-refresh-secret gmail-client-secret gmail-refresh-token"
SA="942889188964-compute@developer.gserviceaccount.com"
for secret in $SECRETS; do
  VERSION_COUNT=$(gcloud secrets versions list "$secret" --project=mental-help-global-25 \
    --filter="state=ENABLED" --format="value(name)" 2>/dev/null | wc -l)
  if [ "$VERSION_COUNT" -eq 0 ]; then
    echo "::error::Secret '$secret' has no active versions"
    exit 1
  fi
done
echo "All secrets validated"
```

---

### R-004: Docker Image chat-types Inclusion

**Decision**: Copy `chat-types/` directory into Docker build context before `npm install`.

**Rationale**: The CI overrides `package.json` to `file:./chat-types`, but the Dockerfile's `COPY package*.json ./` + `npm ci` runs in an isolated context. The chat-types directory must be explicitly copied.

**Pattern** (already implemented in chat-backend PR #19):
```dockerfile
COPY chat-types/ ./chat-types/
RUN npm install  # not npm ci — lockfile was modified by npm pkg set
```

---

### R-005: ESLint Exclusion for Checked-out Dependencies

**Decision**: Use `--ignore-pattern` in the CI lint command.

**Rationale**: The checked-out chat-types directory contains CJS `dist/` output that ESLint's browser rules flag as errors. Rather than modifying the project's `eslint.config.js` (which doesn't need this locally), the CI lint step overrides the command.

**Pattern** (already implemented in chat-frontend PR #9):
```yaml
- name: Lint
  run: npx eslint --ignore-pattern 'chat-types/**' .
```

---

### R-006: chat-client Workflow Removal Scope

**Decision**: Remove all 4 GitHub Actions workflow files from `.github/workflows/`.

**Rationale**: Per clarification, chat-client retains only local npm scripts. The 4 workflows are:
1. `deploy.yml` — Full GCP deploy (frontend+backend). Replaced by split repo deploy jobs.
2. `test-cloud-run.yml` — Cloud Run-based unit tests. Replaced by split repo CI test jobs.
3. `ui-e2e-dev.yml` — E2E test dispatch. Replaced by `chat-ui` CI.
4. `reject-non-develop-prs-to-main.yml` — Branch protection. No longer needed if no CI runs.

**Impact**: The `chat-ui` CI currently triggers on `workflow_run` from "Deploy to GCP" (chat-client). After removal, this trigger becomes dead. The chat-ui workflow already has the correct "Deploy to GCS" trigger for chat-frontend deploys, so only the chat-client reference needs removal.

---

### R-007: Coverage Threshold Management

**Decision**: Process/convention enforced by PR review — not automated.

**Rationale**: Coverage drops are infrequent (only on large feature merges). Automated threshold adjustment is complex and risks silently lowering quality. A reviewer checking whether thresholds need updating is sufficient.

**Convention**: Any PR adding > 500 LOC of untested application code must include a `vitest.config.ts` threshold adjustment with a comment documenting the previous and new values and the reason for the change.
