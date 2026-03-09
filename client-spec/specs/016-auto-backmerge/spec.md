# Feature Specification: Automated Post-Release Backmerge

**Feature Branch**: `016-auto-backmerge`
**Created**: 2026-02-23
**Status**: Draft
**Jira Epic**: [MTB-393](https://mentalhelpglobal.atlassian.net/browse/MTB-393)
**Input**: Retrospective action item #1 from v2026.02.23 release — "Auto-backmerge main → develop after each release"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Automatic backmerge after release merge (Priority: P1)

As a developer, after a release PR is merged to `main`, a backmerge PR
from `main` to `develop` is automatically created in the same repository
so that hotfix and release commits on `main` are always reflected in
`develop` without manual intervention.

**Acceptance criteria:**

- When a push to `main` occurs (release merge), a GitHub Action
  automatically creates a PR from `main` → `develop`
- The PR is titled with the triggering commit/tag reference
- If `main` and `develop` are already in sync, no PR is created
- If a merge conflict exists, the PR is created but marked as
  conflicted, and a notification is posted (PR comment or label)

### User Story 2 - Auto-merge when no conflicts (Priority: P2)

As a developer, when the backmerge PR has no conflicts and all checks
pass, it is automatically merged so that no manual action is required
for clean backmerges.

**Acceptance criteria:**

- If the backmerge PR has no conflicts and required checks pass, it
  is automatically merged (squash or merge commit, per repo policy)
- If conflicts exist, the PR remains open for manual resolution
- A label (e.g., `backmerge`) is applied to distinguish these PRs
  from feature work

## Functional Requirements *(mandatory)*

### FR-001: Backmerge workflow trigger

The workflow MUST trigger on push to `main` branch. It MUST NOT
trigger on pushes to any other branch.

### FR-002: Conditional PR creation

The workflow MUST check whether `main` is ahead of `develop` before
creating a PR. If `main` and `develop` are identical, no PR is
created and the workflow exits successfully.

### FR-003: Conflict handling

If the backmerge PR cannot be cleanly merged, the workflow MUST:
- Create the PR anyway (so the divergence is visible)
- Add a `conflicts` label to the PR
- Post a comment listing the conflicting files

### FR-004: Auto-merge on clean backmerge

When the backmerge PR has no conflicts, the workflow SHOULD enable
auto-merge so it completes without manual intervention (subject to
branch protection rules).

### FR-005: Multi-repository deployment

The workflow MUST be deployable to all repositories that use the
`main`/`develop` branch model: `chat-backend`, `chat-frontend`,
`workbench-frontend`, `chat-frontend-common`, `chat-ui`, `chat-infra`.

### FR-006: Idempotency

If a backmerge PR already exists (from a previous push to `main`
that was not yet merged), the workflow MUST NOT create a duplicate.
It SHOULD update the existing PR if new commits were added to `main`.

## Success Criteria *(mandatory)*

- After every release merge to `main`, a backmerge PR appears in
  `develop` within 5 minutes without manual intervention
- Clean backmerges (no conflicts) are merged automatically within
  10 minutes
- Conflicted backmerges are visibly flagged for manual resolution
- Zero instances of `main`/`develop` divergence persisting beyond
  one business day after a release

## Scope & Boundaries *(mandatory)*

### In Scope

- GitHub Actions workflow for automated backmerge PR creation
- Auto-merge capability for clean backmerges
- Conflict detection and labeling
- Deployment to all 6 repos with `main`/`develop` branches

### Out of Scope

- Automatic conflict resolution (always requires manual intervention)
- Backmerge for repos without a `develop` branch (`chat-ci`,
  `chat-types`, `client-spec`)
- Changes to branch protection rules

## Dependencies *(mandatory)*

- GitHub Actions with `contents: write` and `pull-requests: write`
  permissions
- Branch protection on `develop` must allow the GitHub Actions bot
  to create and merge PRs (or auto-merge must be enabled)

## Assumptions

- The workflow will be implemented as a reusable workflow in `chat-ci`
  and consumed by each target repository
- The `GITHUB_TOKEN` provided to GitHub Actions has sufficient
  permissions to create PRs and enable auto-merge
- Repositories that do not have a `develop` branch are excluded
