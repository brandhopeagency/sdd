# Agent instructions (workflow)

This document defines the standard workflow for agents in this repository. The goal is predictable execution with minimal regressions, and **no changes that do not directly contribute to achieving the task goal**.

## Branch policy (no-conflict develop → main)

- `main` is a **promotion-only** branch.
- **All changes must merge into `develop` first**, and only then be promoted via a PR `develop → main`.
- Direct PRs to `main` from any other branch are not allowed (a repo workflow auto-closes them).

### GitHub settings (manual)

GitHub API branch-protection endpoints are not available for this private repo on the current plan, so protections must be set in the GitHub UI:

- Protect `main`:
  - Require PRs (no direct pushes)
  - Require passing checks (at minimum: `Test (Cloud Run Jobs)` + `UI E2E (Dev)` + `Deploy to GCP`)
- Protect `develop`:
  - Require PRs (no direct pushes)
  - Require passing checks

## General principles

- **Goal-focused**: do not refactor/rename/“clean up” unless required for the task.
- **Traceable**: each stage must leave an artifact (plan, review notes, change list).
- **Validate suggestions**: every proposal/comment must be evaluated for value and relevance.
- **Review loop**: if review finds valid issues, fix them and re-review until no valid issues remain.
- **Plan-only tasks**: if the agent's task is **to produce a plan only**, do **not** create/modify files and do **not** open a pull request.

## Task execution requirements (normative)

These are **requirements** for executing tasks in this repo. When in doubt, follow this section.

- **Full delivery path (MUST for every change)**:
  - Feature branch → PR into `develop` → tests green → dev deploy + UI checks → PR `develop → main` → prod deploy.
  - Evidence-only updates still follow the same path (separate PRs allowed).
- **Relevance check (MUST)**:
  - For each task, first decide: **relevant**, **already solved**, or **no longer relevant**.
  - If a task is already solved / no longer relevant, **delete the task file** (do not implement).
- **Plan + plan validation (MUST)**:
  - For each relevant task, produce a short step-by-step plan and a minimal test plan.
  - Validate the plan for completeness/feasibility/minimalism/verifiability and incorporate only valuable improvements.
- **Testing (MUST)**:
  - Keep all tests green before merge.
  - Add **unit tests** when changing logic, utilities, services, stores, or components.
  - Add/adjust **Playwright UI tests** when changing user-visible UI/UX flows or permission gating.
  - Run local build + relevant unit tests **before pushing or opening a PR** (frontend + backend when applicable).
- **Test evidence (MUST for user-visible issues/recommendations)**:
  - Capture **before/after** screenshots for each user-visible problem or UX recommendation addressed.
  - Store evidence under `evidence/<task-id>/` with `before-*` / `after-*` naming.
  - Include evidence paths + executed test steps in the PR description.
- **Delivery loop (MUST)**:
  - PR → review → fixes (if needed) → squash merge to `develop` → confirm deploy succeeds + UI checks → PR `develop → main` → merge.
  - Do not merge directly into `main` from feature branches.
- **Promotion conflicts (MUST)**:
  - If `develop → main` PR is conflicting, resolve by **back-merging `main` into `develop`** via a dedicated sync PR, then re-run promotion.

## Work stages (must be followed in this order)

### 1) Analysis and planning

- Read the task statement (issue/file, code context, constraints).
- Define the **goal** (what must be true when done).
- Assess risks (regression areas, migrations, access control, security, performance).
- Produce a step-by-step plan (small, verifiable steps) + a minimal test plan.

### 2) Plan review and improvement proposals

- Check the plan for:
  - completeness (all requirements covered),
  - feasibility (access/data/config available),
  - minimalism (no “extra” changes),
  - verifiability (clear acceptance criteria/tests).
- Propose improvements if they increase success rate/quality/security.

### 3) Evaluate proposed changes; incorporate only valuable ones

- For each proposal, assess:
  - **value** (reduces risk, closes a requirement gap, adds verification),
  - **relevance** (directly helps achieve the goal),
  - **cost** (complexity/time/side effects).
- If a proposal is **valuable and relevant** — integrate it into the plan.
- If it is **not required to achieve the goal** — reject it (do not implement it).

### 4) Implement the solution according to the plan

- Implement plan steps **in the planned order**.
- After each substantial step, quickly verify it (run locally/tests/lint if available).
- Do not expand scope: if a “nice refactor” appears, skip it.

### 5) Code review the solution

- Perform self-review (or another-agent/process review if configured).
- Check:
  - requirement/acceptance coverage,
  - security/auth/RBAC/PII,
  - errors and edge cases,
  - performance (pagination, N+1, indexes),
  - migrations/compatibility,
  - test plan (what was actually verified).

### 6) If review comments are valid, apply fixes

- Fix **only valid** comments.
- Avoid scope creep.
- Add/update tests if needed to lock the fix in.

### 7) Re-review; if issues remain, return to step 6

- Confirm issues are addressed and no new ones were introduced.
- Repeat the 6 ↔ 7 loop until review is clean.

### 8) Squash and merge the branch into `develop`

- Ensure:
  - CI is green (or equivalent local checks passed),
  - changes are minimal and match the task,
  - PR/commit message explains “why”, not only “what”.
- Perform a **squash merge** into `develop` (one clean commit).

### 9) Confirm deploy succeeds

- Check deployment pipeline status after merge.
- If deploy fails, identify root cause (logs/artifacts) and fix in a follow-up change, using the same workflow.

## Behavior for the `next task` command

If an agent is started with **`next task`**, it must:

1. Open the `.agent_issues/` folder.
2. Pick the **highest-priority** task file (smallest priority number).
   - Priority is derived from filename prefix: `P<major>.<minor>-...`
   - Lower `major` = higher priority (e.g., `P0.*` outranks `P1.*`).
   - For the same `major`, lower `minor` = higher priority (e.g., `P0.01` outranks `P0.04`).
   - If the format differs, prefer the smallest `P*` prefix and apply common sense; if none exist, pick the task that best matches “urgent/blocking”.
3. Execute the task end-to-end using steps 1–9 in this document.

## Creating tasks (analysis → task breakdown)

If the agent's assignment is to **perform analysis and create tasks**, it must:

- Create one or more task documents in `.agent_issues/`.
- Use the naming convention below so priorities are unambiguous and sortable.

### Task file naming convention

Use:

- `P<major>.<minor>-<kebab-case-title>.md`
  - `major`: priority bucket (0 = highest priority).
  - `minor`: **two digits** (`01`, `02`, …) to keep lexical sorting stable.
  - `kebab-case-title`: short, descriptive, lowercase slug.

Example: `P0.01-pii-permission-and-server-masking.md`

### Task document template

Each `.agent_issues/*.md` file should include (as applicable):

- `## Goal`
- `## Context (files)`
- `## Problem`
- `## Requirements`
- `## Validation / test plan`
- `## Acceptance criteria`
- `## Evidence`
  - Expected paths: `evidence/<task-id>/before-*.png`, `evidence/<task-id>/after-*.png`

## Evidence & testing conventions (practical)

- **Evidence location**: `evidence/<task-id>/`
  - **Before**: `before-<page-or-flow>-<lang>.png` (as applicable)
  - **After**: `after-<page-or-flow>-<lang>.png` (as applicable)
- **Avoid committing transient artifacts**:
  - Do not commit Playwright local output directories (e.g. `.playwright-mcp/`, `playwright-report/`, `test-results/`).
  - Do not commit local coverage output unless a task explicitly requires it.
- **What counts as evidence**:
  - UI/UX change: screenshots are required (before/after).
  - Non-UI change: include the most relevant artifact (e.g., CLI output snippet, logs screenshot) if screenshots are not meaningful.
- **PR description must include**:
  - What tests were executed (unit / e2e) and where (local/CI).
  - Evidence file paths produced for the task.

