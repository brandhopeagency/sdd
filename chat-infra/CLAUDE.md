# CLAUDE.md - Chat Infrastructure

## Project Overview

Infrastructure scripts and Terraform scaffolding for the Mental Health Chat application on Google Cloud Platform.

## Directory Structure

```
scripts/           # GCP setup scripts
  setup.sh         # Main infrastructure setup (buckets, WIF, service accounts)
  setup-db.sh      # Cloud SQL database provisioning
  setup-storage.sh # GCS bucket configuration
  setup-vertex-ai.sh # Vertex AI setup for LLM features
terraform/         # Terraform modules (scaffolding, migration planned)
  environments/
    dev/           # Development environment
    staging/       # Staging environment
    prod/          # Production environment
  modules/         # Shared Terraform modules
```

## GCP Architecture

- **Cloud Run:** Backend API (`chat-backend`, `chat-backend-dev`)
- **Cloud SQL:** PostgreSQL database
- **GCS:** Frontend static hosting (`{project}-frontend`, `{project}-dev-frontend`)
- **Artifact Registry:** Docker images
- **Workload Identity Federation:** GitHub Actions authentication (no keys)

## Usage

```bash
# Initial infrastructure setup
chmod +x scripts/setup.sh
./scripts/setup.sh

# Database setup
chmod +x scripts/setup-db.sh
./scripts/setup-db.sh
```

## CI/CD

CI runs ShellCheck linting on all scripts in `scripts/`.
