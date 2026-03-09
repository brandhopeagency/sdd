# Research: Automated Post-Release Backmerge

## R1: Workflow Architecture — Reusable vs. Standalone

**Decision**: Reusable workflow in `chat-ci` + tiny caller in each target repo

**Rationale**: This matches the existing pattern in `chat-ci` where reusable
workflows (`deploy-backend.yml`, `test-e2e.yml`, etc.) use `workflow_call`
and consumer repos have caller workflows. The backmerge logic is identical
across all repos — centralizing it avoids maintaining 6 copies.

**Alternatives considered**:
- **Standalone per repo**: Simpler initial setup but requires updating 6
  files for any logic change. Rejected because the reusable pattern is
  already established and the team is familiar with it.
- **GitHub App / external service**: Overkill for this use case. A native
  GitHub Actions workflow is sufficient.

## R2: Branch Protection Impact on Auto-Merge

**Decision**: Use `gh pr merge --merge` directly (no auto-merge API needed)

**Rationale**: The `develop` branch in target repos (verified: `chat-backend`)
is NOT protected. This means:
- No required status checks to wait for
- No required reviewers to approve
- The GitHub Actions bot can merge PRs immediately

Since there are no protection rules blocking merge, the workflow can create
the PR and immediately merge it in the same run. No need for the auto-merge
API (`enablePullRequestAutoMerge`) which is designed for protected branches
where you want to merge after checks pass.

**Alternatives considered**:
- **Enable auto-merge via API**: More robust for protected branches but
  unnecessary here. If branch protection is added to `develop` later, the
  workflow should be updated to use `gh pr merge --auto`.
- **Direct push without PR**: Technically possible since `develop` is
  unprotected, but loses PR visibility and audit trail. Rejected per spec
  requirement for PR-based backmerge.

## R3: Conflict Detection Approach

**Decision**: Attempt merge via `gh pr merge`; if it fails, label the PR

**Rationale**: GitHub's PR API accurately reports merge conflicts. The
workflow creates the PR first, then attempts `gh pr merge`. If the merge
fails (non-zero exit), the PR remains open with a `conflicts` label and
a comment listing conflicting files (obtained via `git merge --no-commit`
in a temporary branch).

**Alternatives considered**:
- **Pre-check with `git merge-tree`**: More complex, requires cloning the
  repo in the action. The `gh pr merge` failure path is simpler and the
  PR creation itself already detects conflicts.

## R4: Idempotency — Duplicate PR Prevention

**Decision**: Search for existing open PR with `backmerge` label before
creating a new one

**Rationale**: Use `gh pr list --base develop --head main --label backmerge
--state open` to check for existing backmerge PRs. If one exists, update
its body with the latest commit info instead of creating a duplicate.

## R5: Caller Workflow Deployment

**Decision**: Add caller workflows to all 6 target repos in a single PR
per repo

**Rationale**: Each target repo needs a `.github/workflows/backmerge.yml`
that triggers on `push: branches: [main]` and calls
`MentalHelpGlobal/chat-ci/.github/workflows/backmerge.yml@main`. This is
a one-time setup per repo.

Target repos: `chat-backend`, `chat-frontend`, `workbench-frontend`,
`chat-frontend-common`, `chat-ui`, `chat-infra`

## R6: reject-non-develop-prs-to-main.yml Interaction

**Decision**: No conflict — the backmerge workflow creates PRs to `develop`,
not to `main`

**Rationale**: The existing `reject-non-develop-prs-to-main.yml` in chat-ci
only blocks PRs that target `main` from branches other than `develop`. The
backmerge PR targets `develop` from `main`, which is the opposite direction
and is not affected by this rule.
