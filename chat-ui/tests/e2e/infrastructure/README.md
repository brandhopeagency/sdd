# Infrastructure E2E Suite

## Test file

- `domain-routing.spec.ts`

## Purpose

Validate domain routing and HTTPS behavior for:
- `mentalhelp.chat`
- `www.mentalhelp.chat`

## Run

```bash
npx playwright test tests/e2e/infrastructure/domain-routing.spec.ts
```

## Preconditions

- Target environment is deployed.
- DNS propagation has completed.
