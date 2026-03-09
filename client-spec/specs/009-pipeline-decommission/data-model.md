# Data Model: Pipeline Decommission & CI Consolidation

**Feature**: 009-pipeline-decommission  
**Date**: 2026-02-10

> This feature is CI/CD infrastructure — no database entities are involved.
> This document maps the CI pipeline relationships between repositories instead.

## Repository Dependency Graph

```
chat-types (shared types)
  ├──→ chat-backend (file: dependency, CI checkout + build)
  ├──→ chat-frontend (file: dependency, CI checkout + build)
  └──→ chat-client (file: dependency, local only — no CI)

chat-frontend (deploys to GCS)
  └──→ chat-ui (triggers E2E via workflow_run "Deploy to GCS")

chat-backend (deploys to Cloud Run)
  └──→ GCP Secret Manager (secrets referenced via --set-secrets)

chat-client (local development only)
  └──→ [NO CI — all workflows removed]
```

## CI Workflow Entity Map

| Entity | Type | Lifecycle | Consumed By |
|--------|------|-----------|-------------|
| `PKG_TOKEN` | GitHub repo secret | Manual creation, manual rotation | All split repos (checkout + npm auth) |
| `GCP_WIF_PROVIDER` | GitHub repo secret | Terraform-managed | chat-frontend, chat-backend (deploy jobs) |
| `database-url` | GCP Secret (latest) | Manual, gcloud CLI | Cloud Run chat-backend-dev |
| `jwt-secret` | GCP Secret (latest) | Manual, gcloud CLI | Cloud Run chat-backend-dev |
| `jwt-refresh-secret` | GCP Secret (latest) | Manual, gcloud CLI | Cloud Run chat-backend-dev |
| `gmail-client-secret` | GCP Secret (latest) | Manual, gcloud CLI | Cloud Run chat-backend-dev |
| `gmail-refresh-token` | GCP Secret (latest) | Manual, gcloud CLI | Cloud Run chat-backend-dev |
| `chat-types/dist/` | Built npm package | Rebuilt on every CI run | chat-frontend, chat-backend |

## State Transitions

### CI Pipeline States (per push/PR)

```
[Triggered] → [chat-types checkout] → [chat-types build] → [npm install]
    → [lint] → [test] → [build] → [deploy pre-flight] → [deploy]
```

### Secret Lifecycle

```
[Created (empty)] → [Version added] → [IAM binding added] → [Active]
    → [Version disabled] → [New version added] → [Active]
```
