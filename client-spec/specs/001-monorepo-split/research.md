# Research: Monorepo Split

**Feature**: 001-monorepo-split
**Date**: 2026-02-04

## Git History Preservation

### Decision: git-filter-repo

**Rationale**: git-filter-repo is the recommended approach by the Git project itself, offering superior performance and full history preservation compared to alternatives.

**Alternatives Considered**:

| Approach | Performance | History | Complexity |
|----------|-------------|---------|------------|
| git-filter-repo | Fast (seconds) | Full | Medium |
| git-subtree | Slow (12+ min) | Full or squashed | Low |
| Manual copy | Instant | None | Low |

**Implementation**:
```bash
# Install
pip install git-filter-repo

# Backend split (preserves server/ history)
git clone chat-client chat-backend-temp
cd chat-backend-temp
git filter-repo --path server/ --path-rename server/:

# Frontend split (preserves src/, tests/ history)
git clone chat-client chat-frontend-temp
cd chat-frontend-temp
git filter-repo --path src/ --path tests/e2e/:tests/ --path playwright.config.ts
```

**Caveat**: Commit SHAs will change. Old references (issues, PRs) will point to archived monorepo.

---

## GitHub Actions Reusable Workflows

### Decision: Centralized workflow_call in chat-ci

**Rationale**: GitHub's reusable workflow feature allows defining workflows once and calling them from multiple repositories, reducing duplication and enabling consistent CI/CD.

**Alternatives Considered**:

| Approach | Maintenance | Flexibility | Consistency |
|----------|-------------|-------------|-------------|
| Reusable workflows | Low | High | High |
| Composite actions | Medium | Medium | Medium |
| Copy-paste workflows | High | High | Low |

**Implementation Pattern**:

**chat-ci/.github/workflows/test-backend.yml**:
```yaml
name: Backend Tests
on:
  workflow_call:
    inputs:
      node-version:
        type: string
        default: '20'
    secrets:
      GITHUB_TOKEN:
        required: true

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ inputs.node-version }}
      - run: npm ci
      - run: npm test
```

**chat-backend/.github/workflows/ci.yml**:
```yaml
name: CI
on: [push, pull_request]

jobs:
  test:
    uses: MentalHelpGlobal/chat-ci/.github/workflows/test-backend.yml@v1
    secrets: inherit
```

**Best Practices Applied**:
1. Pin to version tags (@v1), not branches
2. Use `secrets: inherit` for cleaner syntax
3. Keep workflows focused (one purpose each)
4. Document required permissions

---

## Shared Types Package

### Decision: @mhg/chat-types on GitHub Packages

**Rationale**: GitHub Packages provides npm registry within the organization, with authentication tied to GitHub tokens and visibility controls matching repository access.

**Alternatives Considered**:

| Approach | Privacy | Setup | Integration |
|----------|---------|-------|-------------|
| GitHub Packages | Org-private | Simple | Excellent |
| npm public | None | Simple | Good |
| npm private | Paid | Complex | Good |
| Git submodules | Full | Medium | Poor |

**Package Structure**:
```
@mhg/chat-types/
├── src/
│   ├── index.ts           # Re-exports all types
│   ├── rbac.ts            # UserRole, Permission, ROLE_PERMISSIONS
│   ├── conversation.ts    # StoredMessage, DiagnosticInfo, etc.
│   ├── entities.ts        # User, Session, ChatMessage, etc.
│   └── agentMemory.ts     # AgentMemorySystemMessage, etc.
├── dist/                  # Compiled output
├── package.json
└── tsconfig.json
```

**package.json**:
```json
{
  "name": "@mhg/chat-types",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "publishConfig": {
    "registry": "https://npm.pkg.github.com"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/MentalHelpGlobal/chat-types.git"
  }
}
```

**Consumer Configuration** (.npmrc):
```
@mhg:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

---

## Playwright MCP Integration

### Decision: @playwright/mcp with MCP configuration

**Rationale**: Microsoft's official Playwright MCP server enables AI-assisted test development through the Model Context Protocol, allowing Claude and other LLMs to interact with browser automation.

**Alternatives Considered**:

| Approach | AI Integration | Maintenance | Features |
|----------|----------------|-------------|----------|
| @playwright/mcp (Microsoft) | Full | Official | Complete |
| mcp-playwright (Community) | Full | Community | Extended |
| No MCP | None | N/A | Standard |

**Configuration (chat-ui/.mcp.json)**:
```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest"],
      "timeout": 30000,
      "type": "stdio",
      "env": {
        "PLAYWRIGHT_MCP_SNAPSHOT_MODE": "incremental",
        "PLAYWRIGHT_MCP_TEST_ID_ATTRIBUTE": "data-testid"
      }
    }
  }
}
```

**Key Features**:
- Accessibility snapshots for AI understanding (not vision)
- Automatic browser binary management
- Structured tool interface for reliable automation
- Compatible with Claude Code, Cursor, and other MCP clients

---

## API Contract Compatibility

### Decision: Version header with CI validation

**Rationale**: Backend exposes API version in response headers; frontend CI checks compatibility before deployment.

**Implementation**:

**Backend** (adds version header):
```typescript
app.use((req, res, next) => {
  res.setHeader('X-API-Version', process.env.API_VERSION || '1.0.0');
  next();
});
```

**Frontend CI** (validates compatibility):
```yaml
- name: Check API Compatibility
  run: |
    BACKEND_VERSION=$(curl -s -I $BACKEND_URL/health | grep X-API-Version | cut -d: -f2 | tr -d ' ')
    REQUIRED_VERSION=$(cat package.json | jq -r '.apiVersion // "1.0.0"')
    if ! npx semver -r "^$REQUIRED_VERSION" "$BACKEND_VERSION"; then
      echo "API version mismatch: backend=$BACKEND_VERSION, required=$REQUIRED_VERSION"
      exit 1
    fi
```

---

## Current Repository Analysis

### Files to Migrate

| Source Path | Target Repo | Notes |
|-------------|-------------|-------|
| `server/` | chat-backend | All backend code |
| `server/Dockerfile` | chat-backend | Production container |
| `server/Dockerfile.test` | chat-backend | Test container |
| `src/` (except types/) | chat-frontend | All frontend code |
| `src/types/` | chat-types | Shared types package |
| `tests/e2e/` | chat-ui | E2E tests |
| `playwright.config.ts` | chat-ui | Playwright config |
| `infra/` | chat-infra | Infrastructure scripts |
| `.github/workflows/` | chat-ci + individual | Split and refactor |

### Shared Types Inventory

**From src/types/index.ts and server/src/types/index.ts**:
- `UserRole` enum
- `Permission` enum
- `ROLE_PERMISSIONS` constant
- `User`, `AuthenticatedUser` interfaces
- `Session`, `ChatMessage` interfaces
- `Annotation`, `Tag`, `AuditLogEntry` interfaces
- `GroupMembershipSummary`, `GroupMembershipStatus` types

**From conversation.ts**:
- `StoredMessage`, `StoredConversation` interfaces
- `ConversationMetadata`, `DiagnosticInfo` interfaces
- `SentimentAnalysis`, `FlowInfo`, `IntentInfo` interfaces
- `MatchInfo`, `GenerativeInfo`, `WebhookStatus` interfaces

**From agentMemory.ts**:
- `AgentMemorySystemMessage` interface
- `AgentMemoryMetadata` interface

### CI/CD Workflow Mapping

| Current Workflow | New Location | Type |
|------------------|--------------|------|
| deploy.yml (frontend) | chat-ci/deploy-frontend.yml | Reusable |
| deploy.yml (backend) | chat-ci/deploy-backend.yml | Reusable |
| test-cloud-run.yml (fe) | chat-ci/test-frontend.yml | Reusable |
| test-cloud-run.yml (be) | chat-ci/test-backend.yml | Reusable |
| ui-e2e-dev.yml | chat-ci/test-e2e.yml | Reusable |
| reject-non-develop-prs-to-main.yml | Each repo | Copy (simple) |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| History loss during split | Low | High | Use git-filter-repo with validation |
| Package version conflicts | Medium | Medium | Semantic versioning + CI checks |
| CI workflow failures | Medium | Medium | Test in sandbox repo first |
| Deployment downtime | Low | High | Parallel operation period |
| Team confusion | Medium | Low | Clear documentation + training |

---

## References

- [git-filter-repo documentation](https://github.com/newren/git-filter-repo)
- [GitHub Reusable Workflows](https://docs.github.com/en/actions/sharing-automations/reusing-workflows)
- [GitHub Packages npm registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry)
- [Playwright MCP](https://github.com/microsoft/playwright-mcp)
- [Model Context Protocol](https://modelcontextprotocol.io/)
