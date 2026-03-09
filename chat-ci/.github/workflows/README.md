# Workflow Notes

## `infra-domain-validation.yml`

### Purpose

Runs smoke checks for environment domain routing and HTTPS posture.

### Inputs / Secrets

- `MENTALHELP_CERT_STATUS_JSON`: JSON array of certificate status objects used by the certificate active-state gate.

### Expected behavior

- Verifies production endpoint responds over HTTPS.
- Verifies `www` host redirects to canonical apex.
- Fails when non-active certificate states are detected in provided status payload.
