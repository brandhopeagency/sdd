# Quickstart: Automated Post-Release Backmerge

## Prerequisites

- GitHub CLI (`gh`) authenticated with access to MentalHelpGlobal org
- Write access to `chat-ci` and target repositories

## How It Works

After any push to `main` (typically a release merge), the backmerge
workflow:

1. Checks if `main` is ahead of `develop`
2. If yes, creates a PR from `main` → `develop` with label `backmerge`
3. If no conflicts, merges the PR immediately
4. If conflicts, labels the PR with `conflicts` and posts a comment

## Validating the Workflow

After deploying the workflow to a repository:

```bash
# Check if the workflow file exists
gh api repos/MentalHelpGlobal/chat-backend/contents/.github/workflows/backmerge.yml \
  --jq '.name' 2>/dev/null && echo "Workflow exists"

# After a push to main, check for backmerge PRs
gh pr list --repo MentalHelpGlobal/chat-backend \
  --base develop --head main --label backmerge --state all

# Verify main/develop are in sync
gh api repos/MentalHelpGlobal/chat-backend/compare/develop...main \
  --jq '"ahead: \(.ahead_by), behind: \(.behind_by)"'
```

## Manual Backmerge (if workflow unavailable)

```bash
gh pr create --repo MentalHelpGlobal/chat-backend \
  --base develop --head main \
  --title "chore: backmerge main → develop" \
  --body "Manual backmerge after release" \
  --label backmerge

gh pr merge --repo MentalHelpGlobal/chat-backend --merge
```

## Target Repositories

| Repository | Has `develop` | Needs workflow |
|------------|:------------:|:--------------:|
| chat-backend | Yes | Yes |
| chat-frontend | Yes | Yes |
| workbench-frontend | Yes | Yes |
| chat-frontend-common | Yes | Yes |
| chat-ui | Yes | Yes |
| chat-infra | Yes | Yes |
| chat-ci | No | No |
| chat-types | No | No |
| client-spec | No | No |
