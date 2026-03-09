# Implementation Plan: Monorepo Split

**Branch**: `001-monorepo-split` | **Date**: 2026-02-04 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-monorepo-split/spec.md`

## Summary

Split the `chat-client` monorepo into five independent repositories (`chat-backend`, `chat-frontend`, `chat-infra`, `chat-ui`, `chat-ci`) while preserving git history, maintaining zero downtime, and establishing centralized CI/CD management through GitHub Actions reusable workflows. Shared TypeScript types will be extracted to a package published via GitHub Packages.

## Technical Context

**Language/Version**: TypeScript 5.6.2 (frontend), TypeScript 5.9.3 (backend), Node.js 20 LTS
**Primary Dependencies**:
- Frontend: React 18.3.1, Vite 5.4.10, Zustand 5.0.1, React Router 6.28.0, Tailwind CSS 3.4.15
- Backend: Express.js 5.1.0, @google-cloud/dialogflow-cx 5.4.0, pg 8.13.1, jsonwebtoken 9.0.2
- Testing: Vitest 4.0.16, Playwright 1.57.0, @testing-library/react 16.3.1
**Storage**: PostgreSQL (existing), Google Cloud Storage (frontend assets)
**Testing**: Vitest (unit), Playwright (E2E), coverage thresholds 25%/15%
**Target Platform**: Google Cloud Platform (Cloud Run for backend, GCS for frontend)
**Project Type**: Multi-repository (5 repos replacing 1 monorepo)
**Performance Goals**: Backend deployment <10min, Frontend deployment <5min, E2E tests <15min
**Constraints**: Zero downtime migration, parallel operation during transition, backward compatibility
**Scale/Scope**: 5 repositories, ~200 files to migrate, preserve 100+ commits history

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Spec-First Development | ✅ PASS | Spec completed and clarified before planning |
| II. Multi-Repository Orchestration | ✅ PASS | This feature enables multi-repo orchestration |
| III. Test-Aligned Development | ✅ PASS | Preserves existing Vitest + Playwright infrastructure |
| IV. Branch and Integration Discipline | ✅ PASS | Each new repo will have develop/main branch protection |
| V. Privacy and Security First | ✅ PASS | No new user data handling; existing security preserved |
| VI. Accessibility and Internationalization | ✅ PASS | No UI changes; i18n files migrate with frontend |

**Gate Status**: PASSED - Proceeding to Phase 0

## Project Structure

### Documentation (this feature)

```text
specs/001-monorepo-split/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (repository relationships)
├── quickstart.md        # Phase 1 output (migration guide)
├── contracts/           # Phase 1 output (workflow contracts)
│   ├── ci-workflows.md  # Reusable workflow specifications
│   └── shared-types.md  # Shared package API contract
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Target Repository Structure

```text
GitHub Organization: MentalHelpGlobal/
├── chat-backend/                    # Express.js API server
│   ├── src/
│   │   ├── index.ts
│   │   ├── dialogflow.ts
│   │   ├── routes/
│   │   ├── middleware/
│   │   ├── services/
│   │   ├── db/
│   │   └── utils/
│   ├── tests/unit/
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   └── .github/workflows/
│       └── ci.yml                   # Calls chat-ci reusable workflows
│
├── chat-frontend/                   # React/Vite SPA
│   ├── src/
│   │   ├── components/
│   │   ├── features/
│   │   ├── services/
│   │   ├── stores/
│   │   ├── locales/
│   │   └── config/
│   ├── tests/unit/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── .github/workflows/
│       └── ci.yml                   # Calls chat-ci reusable workflows
│
├── chat-ui/                         # Playwright E2E tests
│   ├── tests/
│   │   ├── e2e/
│   │   ├── fixtures/
│   │   └── helpers/
│   ├── playwright.config.ts
│   ├── package.json
│   ├── .mcp.json                    # Playwright MCP configuration
│   └── .github/workflows/
│       └── ci.yml                   # Calls chat-ci reusable workflows
│
├── chat-infra/                      # Infrastructure as Code
│   ├── scripts/
│   │   ├── setup.sh
│   │   ├── setup-db.sh
│   │   └── setup-storage.sh
│   ├── terraform/                   # Future: IaC definitions
│   │   ├── environments/
│   │   │   ├── dev/
│   │   │   ├── staging/
│   │   │   └── prod/
│   │   └── modules/
│   └── .github/workflows/
│       └── ci.yml
│
├── chat-ci/                         # Centralized CI/CD workflows
│   └── .github/workflows/
│       ├── test-backend.yml         # Reusable: Backend unit tests
│       ├── test-frontend.yml        # Reusable: Frontend unit tests
│       ├── test-e2e.yml             # Reusable: Playwright E2E
│       ├── deploy-backend.yml       # Reusable: Cloud Run deployment
│       ├── deploy-frontend.yml      # Reusable: GCS deployment
│       ├── build-docker.yml         # Reusable: Docker build + push
│       └── contract-check.yml       # Reusable: API compatibility
│
└── chat-types/                      # Shared TypeScript types (npm package)
    ├── src/
    │   ├── index.ts                 # Re-exports
    │   ├── rbac.ts                  # UserRole, Permission, ROLE_PERMISSIONS
    │   ├── conversation.ts          # StoredMessage, Dialogflow types
    │   ├── entities.ts              # User, Session, ChatMessage
    │   └── agentMemory.ts
    ├── package.json                 # @mhg/chat-types
    ├── tsconfig.json
    └── .github/workflows/
        └── publish.yml              # Publish to GitHub Packages
```

**Structure Decision**: Multi-repository architecture with 6 repositories total (5 application + 1 shared types package). Each repository is independently deployable with centralized workflow inheritance from `chat-ci`.

## Complexity Tracking

> No constitution violations identified. The multi-repository approach is explicitly required by the feature specification.

| Decision | Rationale | Alternative Rejected |
|----------|-----------|---------------------|
| 6 repos (not 5) | Shared types need separate versioning | Embedding types in backend would couple repos |
| git-filter-repo | Preserves full history, fast | git-subtree too slow for 100+ commits |
| GitHub Packages | Tight GH integration, org-private | npm public registry has privacy concerns |

## Migration Phases

### Phase 0: Preparation (No Production Impact)

1. Create empty repositories in GitHub organization
2. Configure GitHub Packages for `@mhg/chat-types`
3. Set up repository secrets and variables
4. Create initial `chat-ci` reusable workflows

### Phase 1: Shared Types Extraction

1. Extract shared types to `chat-types` repository
2. Publish `@mhg/chat-types@1.0.0` to GitHub Packages
3. Update monorepo to consume from package (validation)

### Phase 2: Repository Population

1. Use `git-filter-repo` to split with history preservation
2. Populate each repository with filtered content
3. Add `chat-ci` workflow references to each repo
4. Configure branch protection (develop/main)

### Phase 3: Parallel Operation

1. Deploy split repos alongside monorepo
2. Route non-production traffic to new deployments
3. Run E2E tests against both deployments
4. Monitor for issues

### Phase 4: Cutover

1. Route production traffic to new deployments
2. Archive original monorepo (read-only)
3. Update documentation and onboarding guides
4. Decommission monorepo CI/CD

## Post-Phase 1 Constitution Re-Check

| Principle | Status | Verification |
|-----------|--------|--------------|
| I. Spec-First Development | ✅ | Implementation follows spec |
| II. Multi-Repository Orchestration | ✅ | Cross-repo references documented |
| III. Test-Aligned Development | ✅ | Test frameworks preserved |
| IV. Branch and Integration Discipline | ✅ | Branch protection planned for all repos |
| V. Privacy and Security First | ✅ | No security regression |
| VI. Accessibility and Internationalization | ✅ | i18n files preserved in frontend |

**Gate Status**: PASSED - Ready for task generation
