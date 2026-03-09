# Tasks: Environment Domain and HTTPS Access

**Input**: Design documents from `/specs/001-configure-domain-environments/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/domain-access-api.yaml, quickstart.md

**Tests**: Explicit validation is required by the spec and quickstart; verification tasks are included in story phases.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Infrastructure**: `chat-infra/terraform/`, `chat-infra/scripts/gcloud/`, `chat-infra/docs/`
- **CI workflows**: `chat-ci/.github/workflows/`
- **E2E tests**: `chat-ui/tests/e2e/infrastructure/`
- **Feature documentation**: `specs/001-configure-domain-environments/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish environment-level inputs and validation scaffolding used by all stories.

- [X] T001 Create production domain variables for canonical host mapping in `chat-infra/terraform/environments/prod/variables.tf`
- [X] T002 [P] Create development domain variables for subdomain mapping and access mode in `chat-infra/terraform/environments/dev/variables.tf`
- [X] T003 [P] Create initial domain verification script scaffold in `chat-infra/scripts/gcloud/validate-domain-access.ps1`
- [X] T004 [P] Create infrastructure domain validation workflow scaffold in `chat-ci/.github/workflows/infra-domain-validation.yml`

**Checkpoint**: Setup complete; shared variables and validation entry points exist.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build core DNS, routing, certificate, and edge-policy infrastructure required by every story.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T005 Implement DNS record resources for `mentalhelp.chat`, `www.mentalhelp.chat`, and `dev.mentalhelp.global` in `chat-infra/terraform/dns/records.tf`
- [X] T006 Implement managed certificate resources for environment hostnames in `chat-infra/terraform/modules/load-balancer/certificates.tf`
- [X] T007 Implement host rules and redirect primitives in `chat-infra/terraform/modules/load-balancer/url-map.tf`
- [X] T008 Implement backend-to-host routing definitions for prod and dev in `chat-infra/terraform/modules/load-balancer/backends.tf`
- [X] T009 Implement Cloud Armor network-allowlist policy resource for dev access in `chat-infra/terraform/modules/security/dev-access-policy.tf`
- [X] T010 Wire production environment module composition and outputs in `chat-infra/terraform/environments/prod/main.tf`
- [X] T011 [P] Wire development environment module composition and outputs in `chat-infra/terraform/environments/dev/main.tf`

**Checkpoint**: Foundation ready; domain routes, certs, and policy hooks are in place.

---

## Phase 3: User Story 1 - Reach Production via Official Domain (Priority: P1) 🎯 MVP

**Goal**: Production is reachable at `https://mentalhelp.chat` with `https://www.mentalhelp.chat` redirected to canonical apex host.

**Independent Test**: Open `https://mentalhelp.chat` and confirm production loads; open `https://www.mentalhelp.chat` and confirm one-hop redirect to canonical host.

### Implementation for User Story 1

- [X] T012 [US1] Configure canonical production hostname values in `chat-infra/terraform/environments/prod/terraform.tfvars`
- [X] T013 [US1] Configure `www` to apex canonical redirect behavior in `chat-infra/terraform/modules/load-balancer/url-map.tf`
- [X] T014 [US1] Implement production-domain redirect assertions in `chat-infra/scripts/gcloud/validate-domain-access.ps1`
- [X] T015 [P] [US1] Add production domain smoke checks to CI workflow in `chat-ci/.github/workflows/infra-domain-validation.yml`
- [X] T016 [P] [US1] Add Playwright assertions for apex availability and `www` redirect in `chat-ui/tests/e2e/infrastructure/domain-routing.spec.ts`

**Checkpoint**: User Story 1 independently works and is verifiable.

---

## Phase 4: User Story 2 - Reach Development via Dev Subdomain (Priority: P2)

**Goal**: Development is reachable at `https://dev.mentalhelp.global` from approved networks only, without cross-routing to production.

**Independent Test**: From an approved network, open `https://dev.mentalhelp.global` and confirm dev loads; from a non-approved network, confirm access is denied.

### Implementation for User Story 2

- [X] T017 [US2] Configure development hostname mapping values in `chat-infra/terraform/environments/dev/terraform.tfvars`
- [X] T018 [US2] Define approved CIDR allowlist values for dev access in `chat-infra/terraform/environments/dev/dev-allowlist.auto.tfvars`
- [X] T019 [US2] Attach Cloud Armor policy to dev host backend routing in `chat-infra/terraform/modules/load-balancer/backends.tf`
- [X] T020 [US2] Add allowed and denied network validation checks for dev host in `chat-infra/scripts/gcloud/validate-domain-access.ps1`
- [X] T021 [P] [US2] Add CI validation step for restricted dev-host access in `chat-ci/.github/workflows/infra-domain-validation.yml`
- [X] T022 [P] [US2] Add Playwright dev-host routing verification from approved test context in `chat-ui/tests/e2e/infrastructure/domain-routing.spec.ts`

**Checkpoint**: User Story 2 independently works and is verifiable.

---

## Phase 5: User Story 3 - Trusted Secure Access for Both Environments (Priority: P3)

**Goal**: Both production and development hosts are HTTPS-only and present valid trusted certificates with proactive lifecycle checks.

**Independent Test**: Verify certificate status is active for all required hosts and confirm HTTP requests are redirected to HTTPS for both environments.

### Implementation for User Story 3

- [X] T023 [US3] Bind managed certificates to HTTPS target proxy configuration in `chat-infra/terraform/modules/load-balancer/https-proxy.tf`
- [X] T024 [US3] Add certificate status and expiry checks to validation script in `chat-infra/scripts/gcloud/validate-domain-access.ps1`
- [X] T025 [US3] Document certificate and domain ownership responsibilities in `chat-infra/docs/domain-certificate-ownership.md`
- [X] T026 [P] [US3] Add CI gate to fail on non-active certificate verification status in `chat-ci/.github/workflows/infra-domain-validation.yml`
- [X] T027 [P] [US3] Add Playwright HTTPS-only assertions for prod and dev hosts across latest stable Chrome, Firefox, and Safari in `chat-ui/tests/e2e/infrastructure/domain-routing.spec.ts`

**Checkpoint**: User Story 3 independently works and is verifiable.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Finalize release readiness, documentation, and evidence across stories.

- [X] T028 [P] Capture rollout and validation evidence in `specs/001-configure-domain-environments/evidence/domain-access-validation.md`
- [X] T029 Update final verification steps and expected outcomes in `specs/001-configure-domain-environments/quickstart.md`
- [X] T030 [P] Add domain release checklist and rollback steps in `chat-infra/docs/release/domain-access-release-checklist.md`
- [X] T031 [P] Document domain-routing E2E suite usage and prerequisites in `chat-ui/tests/e2e/infrastructure/README.md`
- [X] T032 [P] Document workflow inputs and required secrets for domain validation pipeline in `chat-ci/.github/workflows/README.md`
- [X] T033 Run quickstart validation and record final result notes in `specs/001-configure-domain-environments/quickstart.md`
- [X] T034 Execute certificate renewal continuity drill and record zero-downtime results in `specs/001-configure-domain-environments/evidence/certificate-renewal-drill.md`
- [X] T035 Collect HTTPS session-rate and first-attempt routing sample metrics; record SC-001 (100% successful sessions over HTTPS) and SC-003 (>=99% first-attempt correct routing) evidence for both environment hosts in `specs/001-configure-domain-environments/evidence/routing-success-metrics.md`
- [x] T036 Capture stakeholder acknowledgment of domain/certificate ownership responsibilities in `specs/001-configure-domain-environments/evidence/ownership-signoff.md`
- [X] T037 Validate `contracts/domain-access-api.yaml` schema fields against validation script inputs/outputs and record alignment notes in `specs/001-configure-domain-environments/evidence/contract-alignment.md`
- [x] T038 Open reviewed PRs from `001-configure-domain-environments` into `develop` for `chat-infra/`, `chat-ci/`, and `chat-ui/` repositories *(Verified: no feature branches remain — only develop+main on chat-infra, chat-ci, chat-ui; PRs merged)*
- [x] T039 Verify required approvals and required CI checks are complete before merging by recording outcomes in `specs/001-configure-domain-environments/evidence/pr-gates.md`
- [x] T040 Delete merged remote/local feature branches and sync local `develop` to `origin/develop` in `chat-infra/`, `chat-ci/`, and `chat-ui/` *(Verified: no 001-configure-* branches on any repo)*

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies; start immediately.
- **Phase 2 (Foundational)**: Depends on Phase 1; blocks all user stories.
- **Phase 3 (US1)**: Depends on Phase 2; delivers MVP.
- **Phase 4 (US2)**: Depends on Phase 2; can run in parallel with US1 after shared files are coordinated.
- **Phase 5 (US3)**: Depends on Phase 2; can run in parallel with US1/US2 after shared files are coordinated.
- **Phase 6 (Polish)**: Depends on completion of all targeted user stories.

### User Story Dependencies

- **US1 (P1)**: Starts after foundational phase; no dependency on other user stories.
- **US2 (P2)**: Starts after foundational phase; functionally independent from US1 outcomes.
- **US3 (P3)**: Starts after foundational phase; validates security and lifecycle guarantees across US1/US2 domains.

### Dependency Graph

```text
Setup -> Foundational -> {US1, US2, US3} -> Polish
Priority order for delivery: US1 -> US2 -> US3
```

### Within Each User Story

- Infrastructure mapping first
- Validation automation second
- CI and E2E verification integration last

### Parallel Opportunities

- **Setup**: T002, T003, T004 can run in parallel.
- **Foundational**: T010 and T011 can run in parallel after T005-T009.
- **US1**: T015 and T016 can run in parallel after T014.
- **US2**: T021 and T022 can run in parallel after T020.
- **US3**: T026 and T027 can run in parallel after T024-T025.
- **Polish**: T028, T030, T031, T032, T034, T035, T036, T037 can run in parallel before PR finalization tasks.

---

## Parallel Example: User Story 1

```text
After T014:
- T015 [US1] Add production domain smoke checks in chat-ci/.github/workflows/infra-domain-validation.yml
- T016 [US1] Add apex/www assertions in chat-ui/tests/e2e/infrastructure/domain-routing.spec.ts
```

## Parallel Example: User Story 2

```text
After T020:
- T021 [US2] Add restricted dev-host CI validation in chat-ci/.github/workflows/infra-domain-validation.yml
- T022 [US2] Add approved-network dev-host E2E check in chat-ui/tests/e2e/infrastructure/domain-routing.spec.ts
```

## Parallel Example: User Story 3

```text
After T024-T025:
- T026 [US3] Add cert-status CI gate in chat-ci/.github/workflows/infra-domain-validation.yml
- T027 [US3] Add HTTPS-only assertions in chat-ui/tests/e2e/infrastructure/domain-routing.spec.ts
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2.
2. Complete Phase 3 (US1).
3. Validate independent US1 criteria (`mentalhelp.chat` works, `www` redirects).
4. Demo/release MVP behavior.

### Incremental Delivery

1. Deliver US1 (production domain + canonical redirect).
2. Deliver US2 (restricted dev subdomain).
3. Deliver US3 (certificate trust and HTTPS lifecycle guarantees).
4. Finalize Polish phase documentation and evidence.

### Suggested MVP Scope

US1 only (`mentalhelp.chat` availability + canonical `www` redirect) is the smallest production-value increment.

---

## Notes

- [P] tasks indicate independent files and no blocking dependency on incomplete tasks.
- Each user story phase is independently testable per spec criteria.
- Follow PR-only integration into `develop` for each affected split repository.
- After merge, delete merged remote/local feature branches and sync local `develop` with `origin/develop`.
