# Quickstart: Cloud & GitHub Infrastructure Setup

**Feature**: 003-cloud-github-infra
**Date**: 2026-02-08

## Prerequisites

1. **GCP CLI** (`gcloud`) installed and authenticated:

   ```bash
   gcloud auth login
   gcloud config set project mental-help-global-25
   ```

2. **GitHub CLI** (`gh`) installed and authenticated with admin scope:

   ```bash
   gh auth login --scopes admin:org,repo
   ```

3. **jq** installed (JSON processing):

   ```bash
   # macOS
   brew install jq

   # Ubuntu/Debian
   sudo apt-get install jq

   # Windows (via chocolatey)
   choco install jq
   ```

4. **Permissions**:
   - GCP: Owner or Editor role on `mental-help-global-25`
   - GitHub: Admin access to all MentalHelpGlobal repositories

## Quick Setup (All-in-One)

Run the unified entrypoint to configure everything:

```bash
cd D:\src\MHG\chat-infra
./scripts/setup-all.sh
```

This will:
1. Validate prerequisites (gcloud, gh, jq, authentication)
2. Create/verify all secrets in Google Secret Manager
3. Configure all GitHub repositories (environments, secrets,
   variables, branch protection)
4. Run verification and print a summary report

## Individual Scripts

### 1. Secrets Consolidation Only

Ensure all secrets exist in Google Secret Manager:

```bash
./scripts/setup-secrets.sh
```

Options:
- First run: creates missing secrets, prompts for values
- Re-run: reports existing secrets, skips creation (idempotent)

### 2. GitHub Configuration Only

Configure GitHub repositories with environments, secrets, variables,
and branch protection:

```bash
./scripts/setup-github.sh
```

Options:
- Configures all 8 repositories in MentalHelpGlobal org
- Sets environment-level secrets (sourced from Secret Manager)
- Sets environment-level variables (from config files)
- Applies branch protection on `develop` and `main`
- Safe to re-run (all operations are idempotent)

### 3. Verification Only

Check infrastructure state without making changes:

```bash
./scripts/verify.sh
```

Output: pass/fail report per component (secrets, environments,
variables, branch protection).

## Configuration Files

All configuration is externalized in `config/`:

| File | Purpose |
|------|---------|
| `config/secrets.json` | Master list of Secret Manager secrets |
| `config/github-repos.json` | Repository list and per-repo settings |
| `config/github-envs/dev.json` | Dev environment secrets and variables |
| `config/github-envs/prod.json` | Prod environment secrets and variables |

To add a new secret or variable, edit the appropriate config file and
re-run `setup-all.sh`.

## Common Operations

### Rotate a Secret

```bash
# 1. Update the value in Secret Manager
printf 'new-value' | gcloud secrets versions add jwt-secret --data-file=-

# 2. Sync to GitHub (re-run setup-github.sh to propagate)
./scripts/setup-github.sh

# 3. Verify
./scripts/verify.sh
```

### Add a New Repository

1. Add the repository to `config/github-repos.json`
2. Re-run `./scripts/setup-github.sh`

### Add a New Environment Variable

1. Add the variable to `config/github-envs/dev.json` and/or
   `config/github-envs/prod.json`
2. Re-run `./scripts/setup-github.sh`

### Add a New Secret

1. Add the secret definition to `config/secrets.json`
2. Add the GitHub secret mapping to `config/github-envs/*.json`
3. Re-run `./scripts/setup-all.sh`

## Monorepo Equivalent

The same scripts and config files are available in the monorepo:

```bash
cd D:\src\MHG\chat-client
./infra/scripts/setup-all.sh
```

Both locations (`chat-infra` and `chat-client/infra/`) MUST be kept
in sync per the project's dual-target implementation policy.

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `gh: command not found` | Install GitHub CLI: https://cli.github.com/ |
| `gcloud: command not found` | Install Google Cloud SDK: https://cloud.google.com/sdk |
| `ERROR: Permission denied on secret` | Ensure `gcloud auth login` with Owner/Editor role |
| `gh: Resource not accessible by integration` | Run `gh auth login --scopes admin:org,repo` |
| `jq: command not found` | Install jq: https://jqlang.github.io/jq/download/ |
| Rate limit errors from GitHub | Wait and re-run; script handles retries automatically |
| Secret version mismatch after sync | Run `./scripts/verify.sh` to diagnose; re-run setup to fix |
