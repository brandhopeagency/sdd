# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Speckit is a specification-driven development framework that enforces spec-first workflows for feature development. It provides a structured pipeline: **Specify → Plan → Tasks → Implement**.

This is a meta-framework containing workflow tools and templates—not application code.

## Commands

### Primary Workflow (execute in order)

```bash
# 1. Create feature specification from natural language
/speckit.specify "user-facing description of the feature"

# 2. Generate technical implementation plan
/speckit.plan

# 3. Break plan into executable tasks
/speckit.tasks

# 4. Execute tasks (phase-by-phase)
/speckit.implement
```

### Supporting Commands

```bash
/speckit.clarify       # Ask targeted questions to resolve [NEEDS CLARIFICATION] markers
/speckit.analyze       # Cross-artifact consistency check (spec, plan, tasks)
/speckit.checklist     # Generate domain-specific quality checklist
/speckit.constitution  # Create/update project principles
/speckit.taskstoissues # Convert tasks.md to GitHub and/or Jira issues
```

### PowerShell Scripts

```powershell
# Create feature branch and initialize spec structure
.specify/scripts/powershell/create-new-feature.ps1 -Json "feature description"

# Initialize plan artifacts for current feature
.specify/scripts/powershell/setup-plan.ps1 -Json

# Validate prerequisites before task generation
.specify/scripts/powershell/check-prerequisites.ps1 -Json

# Update AI agent context files from plan.md
.specify/scripts/powershell/update-agent-context.ps1 -AgentType claude
```

## Architecture

### Directory Structure

```
.specify/
├── memory/constitution.md     # Project principles (template)
├── templates/                 # spec, plan, tasks, checklist templates
└── scripts/powershell/        # Workflow automation scripts

.claude/commands/              # Claude Code slash commands (speckit.*)

specs/{NNN-feature-name}/      # Generated per-feature (auto-created)
├── spec.md                    # Feature specification (what/why)
├── plan.md                    # Implementation plan (how)
├── tasks.md                   # Actionable task breakdown
├── research.md                # Technical decisions
├── data-model.md              # Entity definitions
├── quickstart.md              # Setup guide
├── contracts/                 # API specifications (OpenAPI)
└── checklists/                # Quality validation checklists
```

### Workflow Phases

1. **Phase 0 (Research)**: Extract unknowns, resolve clarifications → `research.md`
2. **Phase 1 (Design)**: Generate entities, contracts, quickstart → `data-model.md`, `contracts/`, `quickstart.md`
3. **Phase 2 (Implementation)**: Execute tasks from `tasks.md`

### Jira Integration (Atlassian MCP)

Each speckit workflow phase synchronizes with Jira via the Atlassian MCP:

- `/speckit.specify` → Creates Jira **Epic** with spec as description
- `/speckit.plan` → Adds **comment** on Epic with plan summary
- `/speckit.tasks` → Creates Jira **Stories** and **Tasks** under Epic
- `/speckit.implement` → **Transitions** tasks on completion, adds result **comments**
- `/speckit.analyze` → Adds analysis summary **comment** on Epic

Jira keys are recorded in speckit artifacts (`spec.md` header, `tasks.md`
task lines) for bidirectional traceability. If the Atlassian MCP is
unavailable, speckit continues with file-based tracking and records
`PENDING` markers for retroactive Jira sync.

### Branch Naming Convention

Feature branches follow `NNN-short-name` pattern (e.g., `001-user-auth`). The number auto-increments across local branches, remote branches, and `specs/` directories.

### Integration Policy

- `develop` is the integration branch for feature and bugfix work
- Changes MUST reach `develop` only through Pull Requests from feature/bugfix branches
- Pull Requests MUST have required reviews and all required checks passing before merge
- Direct commits or direct merges to `develop` are not allowed under normal workflow
- After successful merge with unit and UI/E2E checks passed:
  - delete the remote feature/bugfix branch
  - delete the local feature/bugfix branch
  - sync local `develop` with `origin/develop`

### PR Cycle Requirements

- Start from a dedicated `feature/*` or `bugfix/*` branch created from `develop`.
- Validate relevant unit and UI/E2E tests before opening a PR.
- Open PR to `develop` with scope, risk notes, and concrete test evidence.
- Resolve review feedback in follow-up commits on the same branch.
- Merge only after all required checks are green and required approvals are present.
- Prefer squash merge for clean history unless repository policy explicitly differs.
- Post-merge housekeeping is mandatory: delete remote branch, delete local branch, and hard-sync local `develop` to `origin/develop`.

### Release Promotion To Main And Production

- Cut a short-lived `release/*` branch from `develop` at an agreed release cut-off.
- Run full release verification on `release/*` (unit/integration/UI and migration safety checks).
- Open PR from `release/*` to `main` with scope, risks, rollback notes, and test evidence.
- Merge into `main` only after required reviews and all required checks are green.
- Create an immutable release tag on the merged `main` commit.
- Deploy production from that exact tagged `main` commit (never directly from `develop`).
- Run post-deploy smoke checks on critical flows; rollback by redeploying the previous known-good tag when needed.
- After every release merge to `main`, create and merge a backmerge PR from `main` to `develop` in each affected repository to prevent divergence.

### Dev UI Testing Prerequisites

- Use the currently deployed dev frontend URL from the latest CI/CD deploy output.
- Use an approved account with the required workbench/review permissions.
- For OTP login in dev, retrieve the OTP from browser console output.
- Validate that frontend and backend are from the same deployment cycle before debugging API errors.
- Confirm active group/space selection is valid for the authenticated account.
- During review validation, test at least one session with reviewable assistant messages.
- Always capture browser console and network errors (endpoint + HTTP status) as evidence.

## Key Patterns

### Task Format in tasks.md

```markdown
- [ ] T001 [P] [US1] Description with file path in src/path/file.ext
```

- `- [ ]`: Markdown checkbox (required)
- `T001`: Sequential task ID
- `[P]`: Parallelizable marker (optional)
- `[US1]`: User story reference (required for story phases)
- File path: Exact location for implementation

### Spec Quality Rules

- Focus on WHAT users need and WHY (business value)
- No implementation details (languages, frameworks, APIs)
- Maximum 3 `[NEEDS CLARIFICATION]` markers per spec
- Success criteria must be measurable and technology-agnostic
- For user-facing work, include explicit responsive behavior requirements
  and PWA installability expectations for modern mobile compatibility

### Non-Git Fallback

Scripts support repositories without git:
- `SPECIFY_FEATURE` environment variable overrides branch detection
- Falls back to latest `specs/NNN-*` directory for current feature
- Branch creation skipped with warning
