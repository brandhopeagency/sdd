# Quickstart: Environment Domain and HTTPS Access

## Purpose

Roll out and validate environment domain routing so:
- Production is available at `https://mentalhelp.chat`
- `https://www.mentalhelp.chat` redirects to `https://mentalhelp.chat`
- Development UI is available at `https://dev.mentalhelp.chat`
- Both environments are HTTPS-only with verified certificates

## Prerequisites

- Access to GCP project `mental-help-global-25`
- Permissions to manage DNS, load balancer routing, certificates, and edge security policies
- Approved CIDR allowlist for development environment access
- Feature branch `001-configure-domain-environments` in affected split repos

## Step 1: Apply infrastructure changes

1. Update environment domain mappings and host rules in `chat-infra`.
2. Configure HTTPS-only redirect behavior for managed hosts.
3. Configure canonical redirect from `www.mentalhelp.chat` to `mentalhelp.chat`.
4. Attach verified certificates for all required hosts.
5. Ensure host-based routing serves development frontend on `dev.mentalhelp.chat`.

## Step 2: Run deployment validation checks

Run scripted checks from approved networks:

```powershell
gcloud config set project mental-help-global-25
gcloud compute ssl-certificates list
gcloud compute url-maps list
```

Expected:
- certificates for required hosts are active/valid
- URL map reflects HTTPS enforcement and canonical redirect

## Step 3: Verify runtime behavior

From an approved network:

```powershell
curl -I http://mentalhelp.chat
curl -I https://mentalhelp.chat
curl -I https://www.mentalhelp.chat
curl -I https://dev.mentalhelp.chat
```

From a non-approved network (for dev-only check):

```powershell
curl -I https://dev.mentalhelp.chat
```

Expected:
- HTTP to production redirects to HTTPS
- `www` redirects to canonical apex host
- production HTTPS returns success and trusted certificate
- dev HTTPS returns development UI content from dev frontend bucket

## Step 4: Execute E2E smoke checks

1. Run the domain routing and TLS smoke spec in `chat-ui`.
2. Confirm no certificate trust warnings and expected redirect/access outcomes.
3. Store evidence artifacts under `evidence/<task-id>/` during implementation phase.

## Step 5: Record operational evidence

1. Record baseline validation in `evidence/domain-access-validation.md`.
2. Record renewal continuity drill outcomes in `evidence/certificate-renewal-drill.md`.
3. Record HTTPS/routing metrics in `evidence/routing-success-metrics.md`.
4. Record ownership acknowledgment in `evidence/ownership-signoff.md`.
5. Record contract/script alignment in `evidence/contract-alignment.md`.

## Rollback guidance

- Revert infra change set in `chat-infra` to previous known-good state.
- Re-apply prior DNS/URL map/security policy configuration.
- Re-run validation checks to confirm restored behavior.

## Execution Notes (Current Run)

- Validation script execution was attempted.
- Current blocker: `mentalhelp.chat` does not resolve yet from this environment.
- Until DNS and live endpoints are available, runtime quickstart checks should be treated as pending.
