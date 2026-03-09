# Domain Access Release Checklist

## Pre-merge

- [ ] Terraform changes reviewed for production domain environment
- [ ] `validate-domain-access.ps1` execution verified for target project
- [ ] CI workflow `infra-domain-validation.yml` passes
- [ ] Playwright infrastructure suite updated and reviewed

## Pre-deploy

- [ ] DNS records verified for apex and www hostnames
- [ ] Managed certificates are `ACTIVE`

## Post-deploy

- [ ] `https://mentalhelp.chat` returns expected production content
- [ ] `https://www.mentalhelp.chat` redirects to canonical apex host
- [ ] Evidence updated in `specs/001-configure-domain-environments/evidence/`

## Rollback

- Revert Terraform change set to previous known-good revision.
- Apply rollback and rerun validation script.
