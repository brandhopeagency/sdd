# Tasks: Automated Post-Release Backmerge

**Input**: Design documents from `/specs/016-auto-backmerge/`
**Prerequisites**: plan.md (required), spec.md (required), research.md
**Jira Epic**: [MTB-393](https://mentalhelpglobal.atlassian.net/browse/MTB-393)

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2)

## Phase 1: Setup

**Purpose**: Create feature branches in affected repositories

- [ ] T001 Create feature branch `016-auto-backmerge` from `develop` in `chat-ci` — MTB-396
- [ ] T002 [P] Create feature branch `016-auto-backmerge` from `develop` in `chat-backend`, `chat-frontend`, `workbench-frontend`, `chat-frontend-common`, `chat-ui`, `chat-infra` — MTB-396

---

## Phase 2: User Story 1 — Automatic Backmerge PR Creation (Priority: P1) MVP

**Goal**: After a push to `main`, a GitHub Action automatically creates a PR from `main` → `develop` with divergence detection, idempotency, and conflict labeling.

**Independent Test**: Merge a PR to `main` in any target repo → verify a backmerge PR appears in `develop` within 5 minutes with label `backmerge` and commit list in body.

### Reusable Workflow (chat-ci)

- [ ] T003 [US1] Create reusable workflow `chat-ci/.github/workflows/backmerge.yml` with `workflow_call` trigger accepting `base_branch` (default: `develop`) and `head_branch` (default: `main`) inputs. Include `permissions: contents: write, pull-requests: write`. Implement step 1: checkout repo with `fetch-depth: 0` — MTB-397
- [ ] T004 [US1] Add divergence check step to `chat-ci/.github/workflows/backmerge.yml` — use `gh api repos/$GITHUB_REPOSITORY/compare/$base_branch...$head_branch --jq '.ahead_by'` to detect if `main` is ahead of `develop`. If `ahead_by == 0`, output `skip=true` and exit job successfully — MTB-397
- [ ] T005 [US1] Add idempotency check step to `chat-ci/.github/workflows/backmerge.yml` — use `gh pr list --base $base_branch --head $head_branch --label backmerge --state open --json number,url --jq '.[0]'` to detect existing backmerge PR. If found, update PR body with latest commit list and exit without creating duplicate — MTB-397
- [ ] T006 [US1] Add PR creation step to `chat-ci/.github/workflows/backmerge.yml` — create PR with `gh pr create --base $base_branch --head $head_branch --title "chore: backmerge $head_branch → $base_branch (triggered by $GITHUB_SHA)" --label backmerge --body "<commit list>"`. Generate commit list with `gh api repos/$GITHUB_REPOSITORY/compare/$base_branch...$head_branch --jq '.commits[].commit.message'` — MTB-397
- [ ] T007 [US1] Add conflict detection step to `chat-ci/.github/workflows/backmerge.yml` — after PR creation, check `gh pr view $PR_NUMBER --json mergeable --jq '.mergeable'`. If `CONFLICTING`, add `conflicts` label via `gh pr edit --add-label conflicts` and post comment listing conflicting files — MTB-397

### Caller Workflows (6 target repos)

- [ ] T008 [P] [US1] Create caller workflow `chat-backend/.github/workflows/backmerge.yml` — trigger on `push: branches: [main]`, call `MentalHelpGlobal/chat-ci/.github/workflows/backmerge.yml@main` with `permissions: contents: write, pull-requests: write` — MTB-398
- [ ] T009 [P] [US1] Create caller workflow `chat-frontend/.github/workflows/backmerge.yml` — identical to T008 — MTB-398
- [ ] T010 [P] [US1] Create caller workflow `workbench-frontend/.github/workflows/backmerge.yml` — identical to T008 — MTB-398
- [ ] T011 [P] [US1] Create caller workflow `chat-frontend-common/.github/workflows/backmerge.yml` — identical to T008 — MTB-398
- [ ] T012 [P] [US1] Create caller workflow `chat-ui/.github/workflows/backmerge.yml` — identical to T008 — MTB-398
- [ ] T013 [P] [US1] Create caller workflow `chat-infra/.github/workflows/backmerge.yml` — identical to T008 — MTB-398

**Checkpoint**: Backmerge PRs are created automatically when `main` is pushed. Conflict detection labels PRs. Idempotency prevents duplicates. This is the MVP.

---

## Phase 3: User Story 2 — Auto-Merge Clean Backmerges (Priority: P2)

**Goal**: When the backmerge PR has no conflicts, it is merged automatically without manual intervention.

**Independent Test**: Push to `main` with a clean forward merge → verify the backmerge PR is created AND merged within 10 minutes with no human action.

- [ ] T014 [US2] Add auto-merge step to `chat-ci/.github/workflows/backmerge.yml` — after PR creation and conflict check, if mergeable status is `MERGEABLE`, run `gh pr merge $PR_NUMBER --merge --delete-branch=false`. On merge success, post summary comment. On merge failure, fall back to conflict handling path from T007 — MTB-399
- [ ] T015 [US2] Add `develop` branch existence check to `chat-ci/.github/workflows/backmerge.yml` — at workflow start, verify `$base_branch` exists via `gh api repos/$GITHUB_REPOSITORY/branches/$base_branch`. If missing, log warning and exit gracefully without error — MTB-399

**Checkpoint**: Clean backmerges are fully automated end-to-end. Conflicted backmerges remain open for manual resolution.

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Merge, verify, and document

- [ ] T016 Open PR from `016-auto-backmerge` branch to `main` in `chat-ci`, obtain required reviews, and merge — MTB-400
- [ ] T017 [P] Open PRs from `016-auto-backmerge` branch to `develop` in all 6 target repos (chat-backend, chat-frontend, workbench-frontend, chat-frontend-common, chat-ui, chat-infra), obtain reviews, and merge — MTB-400
- [ ] T018 Verify workflow triggers correctly by confirming the backmerge PR auto-created after T016 merge to `main` in chat-ci — if chat-ci has no `develop` branch, trigger manually in one target repo by pushing to `main` — MTB-400
- [ ] T019 [P] Update Confluence Technical Onboarding with documentation of the backmerge workflow: purpose, trigger, expected behavior, conflict resolution procedure — MTB-400
- [ ] T020 Delete merged remote feature branches and purge local feature branches in all affected repos — MTB-400
- [ ] T021 Sync local `develop` to `origin/develop` in each affected repository — MTB-400
- [ ] T022 Add completion summary comment to Jira Epic MTB-393 with evidence references and outcome — MTB-400

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **US1 (Phase 2)**: Depends on Setup — core MVP
- **US2 (Phase 3)**: Depends on US1 — extends the workflow with auto-merge
- **Polish (Phase 4)**: Depends on US1 + US2

### User Story Dependencies

- **US1 (P1)**: Reusable workflow MUST be created (T003–T007) before caller workflows (T008–T013). Callers are all parallelizable.
- **US2 (P2)**: Depends on US1 completion — extends the same workflow file.

### Parallel Opportunities

- T001, T002 can run in parallel (different repos)
- T008–T013 can ALL run in parallel (6 different repos, identical file)
- T017, T019 can run in parallel (different activities)

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (branches)
2. Complete Phase 2: US1 (reusable workflow + callers)
3. **STOP and VALIDATE**: Merge reusable workflow to `main` in `chat-ci`, then push to `main` in a target repo. Verify backmerge PR appears.

### Incremental Delivery

1. Setup → branches ready
2. US1 → backmerge PRs created automatically (**MVP**)
3. US2 → clean backmerges merged automatically
4. Polish → merge, document, cleanup

---

## Notes

- **Jira transitions**: Each Jira Task MUST be transitioned to Done immediately when the corresponding task is marked `[X]` — do NOT batch transitions at the end.
- [P] tasks = different files/repos, no dependencies
- [Story] label maps task to specific user story for traceability
- The reusable workflow in `chat-ci` must be merged to `main` before caller workflows can reference it
- `chat-ci` itself has no `develop` branch, so the backmerge caller is NOT added there — `chat-ci` only hosts the reusable workflow
- After merge, delete remote/local feature branches and sync local `develop`
