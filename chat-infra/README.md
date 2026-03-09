# GCP Infrastructure Setup

This folder contains scripts to set up GCP infrastructure for the Mental Health Chat application with **multi-environment support** (dev + prod).

## Architecture Overview

```
Branch: develop  ──►  Environment: dev   ──►  chat-backend-dev, {project}-dev-frontend
Branch: main     ──►  Environment: prod  ──►  chat-backend, {project}-frontend
```

**Single GCP Project** with environment-prefixed resources:
- Buckets: `{project}-dev-frontend`, `{project}-frontend`
- Cloud Run: `chat-backend-dev`, `chat-backend`
- Shared: Artifact Registry, WIF pool, Service Account

## Prerequisites

1. **Google Cloud SDK (gcloud CLI)** - [Install Guide](https://cloud.google.com/sdk/docs/install)
2. **GCP Project** with billing enabled
3. **Sufficient permissions** - Owner or Editor role on the project
4. **GitHub repository** - The repository where you'll run GitHub Actions

## Quick Start

### 1. Run the Setup Script

```bash
# Make the script executable
chmod +x infra/setup.sh

# Run the setup script (auto-detects project from gcloud config)
./infra/setup.sh
```

The script will automatically:
- Detect PROJECT_ID and PROJECT_NUMBER from gcloud
- Create buckets for both environments (dev + prod)
- Create shared Artifact Registry
- Set up Workload Identity Federation
- Create and configure Service Account
- Output all GitHub secrets and environment configuration

### 2. Configure GitHub Environments

After running the script, follow the output instructions to set up GitHub:

#### Repository Secrets (shared)

Go to **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Description |
|--------|-------------|
| `GCP_PROJECT_ID` | Your GCP project ID |
| `GCP_WIF_PROVIDER` | WIF provider path (from script output) |
| `GCP_SERVICE_ACCOUNT` | Service account email |
| `DIALOGFLOW_PROJECT_ID` | Dialogflow project ID |
| `DIALOGFLOW_AGENT_ID` | Dialogflow CX agent UUID |
| `DIALOGFLOW_LOCATION` | `global` or region |

#### GitHub Environments

Go to **Settings → Environments → New environment**:

**Environment: `dev`**
- Deployment branches: `develop`
- Secrets:
  - `GCS_BUCKET` = `{project}-dev-frontend`
  - `FRONTEND_URL` = `https://storage.googleapis.com/{project}-dev-frontend`
  - `BACKEND_URL` = (add after first deploy)

**Environment: `prod`**
- Deployment branches: `main`
- Protection rules: Required reviewers (recommended)
- Secrets:
  - `GCS_BUCKET` = `{project}-frontend`
  - `FRONTEND_URL` = `https://storage.googleapis.com/{project}-frontend`
  - `BACKEND_URL` = (add after first deploy)

### 3. Deploy

```bash
# Deploy to dev
git checkout develop
git push origin develop

# Deploy to prod
git checkout main
git merge develop
git push origin main
```

Or use manual deployment:
1. Go to **Actions** tab
2. Select **Deploy to GCP** workflow
3. Click **Run workflow**
4. Select environment (dev/prod)

## Automated Infrastructure Management (NEW)

The following scripts automate GitHub and Secret Manager configuration
across all MentalHelpGlobal repositories. They are config-driven and
idempotent — safe to re-run at any time.

### Prerequisites

- **gcloud CLI** authenticated (`gcloud auth login`)
- **GitHub CLI** authenticated with admin scope (`gh auth login --scopes admin:org,repo`)
- **jq** installed ([download](https://jqlang.github.io/jq/download/))

### Scripts

| Script | Purpose |
|--------|---------|
| `scripts/setup-all.sh` | Unified entrypoint: runs secrets + github + verify |
| `scripts/setup-secrets.sh` | Create/verify secrets in Google Secret Manager |
| `scripts/setup-github.sh` | Configure GitHub environments, secrets, variables, branch protection |
| `scripts/verify.sh` | Audit infrastructure state (read-only) |
| `scripts/lib/common.sh` | Shared functions (logging, checks, helpers) |

### Configuration Files

| File | Purpose |
|------|---------|
| `config/secrets.json.example` | Template for Secret Manager inventory |
| `config/github-repos.json.example` | Template for repository and branch protection config |
| `config/github-envs/dev.json.example` | Template for dev environment secrets and variables |
| `config/github-envs/prod.json.example` | Template for prod environment secrets and variables |

Before first use, copy templates to local runtime config files:

```bash
cp config/secrets.json.example config/secrets.json
cp config/github-repos.json.example config/github-repos.json
cp config/github-envs/dev.json.example config/github-envs/dev.json
cp config/github-envs/prod.json.example config/github-envs/prod.json
```

### Usage

```bash
# Full setup (recommended)
./scripts/setup-all.sh

# Individual scripts
./scripts/setup-secrets.sh              # Create missing secrets
./scripts/setup-secrets.sh --audit-only # Report only
./scripts/setup-github.sh              # Configure all repos
./scripts/setup-github.sh --repo NAME  # Configure single repo
./scripts/verify.sh                    # Audit infrastructure
```

### Common Operations

**Rotate a secret:**
```bash
printf 'new-value' | gcloud secrets versions add jwt-secret --data-file=-
./scripts/setup-github.sh   # Sync to GitHub
./scripts/verify.sh         # Confirm
```

**Add a new environment variable:**
1. Edit `config/github-envs/dev.json` and/or `config/github-envs/prod.json`
2. Run `./scripts/setup-github.sh`

**Add a new secret:**
1. Add definition to `config/secrets.json`
2. Add GitHub mapping to `config/github-envs/*.json`
3. Run `./scripts/setup-all.sh`

---

## Manual Setup

If you prefer to run commands manually, see below.

### Enable APIs

```bash
gcloud services enable \
  storage.googleapis.com \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  iamcredentials.googleapis.com \
  cloudresourcemanager.googleapis.com \
  iam.googleapis.com
```

### Create Buckets

```bash
PROJECT_ID=$(gcloud config get-value project)
REGION="europe-west1"

# Dev bucket
gcloud storage buckets create "gs://${PROJECT_ID}-dev-frontend" \
  --location="${REGION}" \
  --uniform-bucket-level-access

gcloud storage buckets add-iam-policy-binding "gs://${PROJECT_ID}-dev-frontend" \
  --member=allUsers \
  --role=roles/storage.objectViewer

gcloud storage buckets update "gs://${PROJECT_ID}-dev-frontend" \
  --web-main-page-suffix=index.html \
  --web-error-page=index.html

# Prod bucket
gcloud storage buckets create "gs://${PROJECT_ID}-frontend" \
  --location="${REGION}" \
  --uniform-bucket-level-access

gcloud storage buckets add-iam-policy-binding "gs://${PROJECT_ID}-frontend" \
  --member=allUsers \
  --role=roles/storage.objectViewer

gcloud storage buckets update "gs://${PROJECT_ID}-frontend" \
  --web-main-page-suffix=index.html \
  --web-error-page=index.html
```

### Create Artifact Registry

```bash
gcloud artifacts repositories create chat-backend \
  --repository-format=docker \
  --location="${REGION}" \
  --description="Docker images for chat backend (all environments)"
```

### Set up Workload Identity Federation

```bash
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
GITHUB_REPO="your-org/chat-client"  # Change this!

# Create pool
gcloud iam workload-identity-pools create "github-pool" \
  --location="global" \
  --display-name="GitHub Actions Pool"

# Create provider
gcloud iam workload-identity-pools providers create-oidc "github-provider" \
  --location="global" \
  --workload-identity-pool="github-pool" \
  --display-name="GitHub provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository=='${GITHUB_REPO}'" \
  --issuer-uri="https://token.actions.githubusercontent.com"
```

### Create and Configure Service Account

```bash
SA_NAME="github-actions-sa"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

# Create service account
gcloud iam service-accounts create "${SA_NAME}" \
  --display-name="GitHub Actions Service Account"

# Grant roles
for role in roles/storage.objectAdmin roles/run.admin roles/artifactregistry.writer; do
  gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="${role}"
done

# Grant actAs for Cloud Run
gcloud iam service-accounts add-iam-policy-binding \
  "${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/iam.serviceAccountUser"

# Bind WIF to service account
gcloud iam service-accounts add-iam-policy-binding "${SA_EMAIL}" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/attribute.repository/${GITHUB_REPO}" \
  --role="roles/iam.workloadIdentityUser"
```

## Local Development

For local development without deploying:

### Option 1: User Credentials (Recommended)

```bash
gcloud auth application-default login
```

### Option 2: Service Account Key

Create a dev-only service account:

```bash
gcloud iam service-accounts create local-dev-sa \
  --display-name="Local Development"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:local-dev-sa@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/dialogflow.client"

gcloud iam service-accounts keys create ./local-dev-key.json \
  --iam-account=local-dev-sa@$PROJECT_ID.iam.gserviceaccount.com
```

Then set the environment variable:
```bash
export GOOGLE_APPLICATION_CREDENTIALS="./local-dev-key.json"
```

**Important:** Never commit key files! Add to `.gitignore`:
```
*.json
!package*.json
```

## Troubleshooting

### "Permission denied" errors

Ensure you have Owner or Editor role:
```bash
gcloud projects get-iam-policy $PROJECT_ID \
  --filter="bindings.members:$(gcloud config get-value account)"
```

### WIF authentication fails in GitHub Actions

1. Verify GitHub repository name matches exactly (case-sensitive)
2. Check the WIF provider attribute condition
3. Ensure service account has `workloadIdentityUser` role

### Cloud Run deployment fails

1. Check service account has `roles/run.admin`
2. Verify actAs permission on compute service account
3. Check logs: `gcloud run services logs read chat-backend-dev --region=$REGION`

### After first backend deploy

Get the Cloud Run URL and update `BACKEND_URL` secret:
```bash
# For dev
gcloud run services describe chat-backend-dev --region=europe-west1 --format="value(status.url)"

# For prod
gcloud run services describe chat-backend --region=europe-west1 --format="value(status.url)"
```

## Clean Up

Remove all resources:

```bash
PROJECT_ID=$(gcloud config get-value project)
REGION="europe-west1"

# Delete Cloud Run services
gcloud run services delete chat-backend-dev --region=$REGION --quiet
gcloud run services delete chat-backend --region=$REGION --quiet

# Delete Artifact Registry
gcloud artifacts repositories delete chat-backend --location=$REGION --quiet

# Delete buckets
gcloud storage rm -r "gs://${PROJECT_ID}-dev-frontend"
gcloud storage rm -r "gs://${PROJECT_ID}-frontend"

# Delete service account
gcloud iam service-accounts delete "github-actions-sa@${PROJECT_ID}.iam.gserviceaccount.com" --quiet

# Delete WIF
gcloud iam workload-identity-pools providers delete github-provider \
  --location=global --workload-identity-pool=github-pool --quiet
gcloud iam workload-identity-pools delete github-pool --location=global --quiet
```
