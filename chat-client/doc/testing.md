# Testing guide

## Frontend unit tests (Vitest + RTL + MSW)
- Install deps: `npm ci`
- Run once: `npm test`
- Watch mode: `npm run test:watch`
- Coverage: `npm run test:coverage`
- Tests live under `src/test/unit/`; shared setup in `src/test/setup.ts`.
- Coverage thresholds are enforced in `vitest.config.ts` (CI fails if below).

## Backend unit tests (Vitest)
- Install deps: `cd server && npm ci`
- Run once: `npm test`
- Watch mode: `npm run test:watch`
- Coverage: `npm run test:coverage`
- Tests live under `server/tests/unit/`; config in `server/vitest.config.ts`.
- Coverage thresholds are enforced in `server/vitest.config.ts` (CI fails if below).

## Frontend E2E (Playwright, separate from Cloud Run jobs)
- Install deps: `npm ci`
- Run E2E: `npm run test:e2e` (starts Vite dev server on port 4173 unless `PLAYWRIGHT_BASE_URL` is set).
- Headed mode: `npm run test:e2e:headed`
- Tests live under `tests/e2e/`; config in `playwright.config.ts`.

## CI: Cloud Run Jobs workflow
- Workflow: `.github/workflows/test-cloud-run.yml` (runs on pull_request).
- Builds two images via Cloud Build and runs as Cloud Run Jobs:
  - FE: `Dockerfile.test.fe` -> job `fe-tests` runs `npm run test:coverage`.
  - BE: `server/Dockerfile.test` -> job `be-tests` runs `npm run test:coverage`.
- Requires GitHub secrets/vars: `GCP_WIF_PROVIDER`, `GCP_SERVICE_ACCOUNT`, `GCP_PROJECT_ID`, plus Artifact Registry `chat-tests` (or adjust `TEST_ARTIFACT_REGISTRY` env).
- Jobs stream logs; coverage is available in logs by default. For persisted coverage, export `coverage/` to GCS from the job.

