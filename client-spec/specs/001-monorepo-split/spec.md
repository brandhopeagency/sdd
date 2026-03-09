# Feature Specification: Monorepo Split

**Feature Branch**: `001-monorepo-split`
**Created**: 2026-02-04
**Status**: Complete
**Jira Epic**: MTB-31
**Input**: Split chat-client monorepo into separate repositories for backend, frontend, infrastructure, and UI tests with centralized CI

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Independent Backend Development (Priority: P1)

As a backend developer, I want to work in a dedicated backend repository so that I can develop, test, and deploy API changes without being affected by frontend code changes or CI/CD pipeline conflicts.

**Why this priority**: Backend is the foundation that frontend depends on. Independent backend development enables faster iteration on API features, database changes, and integrations without waiting for frontend CI to complete. This unblocks parallel team work.

**Independent Test**: Can be fully tested by cloning `chat-backend`, running unit tests, and deploying to a staging environment. Backend delivers value as a standalone API service.

**Acceptance Scenarios**:

1. **Given** a developer clones `chat-backend`, **When** they run the test command, **Then** all unit tests execute successfully without requiring any frontend code
2. **Given** a backend change is pushed, **When** CI runs, **Then** only backend-specific tests and deployment steps execute
3. **Given** the backend is deployed, **When** a health check is performed, **Then** the API responds correctly independent of frontend deployment status

---

### User Story 2 - Independent Frontend Development (Priority: P2)

As a frontend developer, I want to work in a dedicated frontend repository so that I can develop, test, and deploy UI changes without waiting for backend pipelines or being blocked by backend test failures.

**Why this priority**: Frontend development can proceed independently once API contracts are defined. Separating frontend enables faster UI iteration and allows frontend developers to work with mocked APIs during development.

**Independent Test**: Can be fully tested by cloning `chat-frontend`, running unit tests with mocked API responses, and building for production. Frontend delivers value as a deployable static site.

**Acceptance Scenarios**:

1. **Given** a developer clones `chat-frontend`, **When** they run tests, **Then** all unit tests pass using mocked API responses without requiring a running backend
2. **Given** a frontend change is pushed, **When** CI runs, **Then** only frontend build, lint, and unit tests execute
3. **Given** the frontend is built, **When** deployed to static hosting, **Then** it loads correctly and connects to the configured backend URL

---

### User Story 3 - Centralized CI/CD Management (Priority: P3)

As a DevOps engineer, I want CI/CD workflows centralized in a dedicated repository so that I can manage, version, and update build/deploy pipelines without modifying application code repositories.

**Why this priority**: Centralized CI enables consistent pipeline management across all repositories, reduces duplication, and allows infrastructure changes without touching application repos. This is essential for maintainability as the number of repositories grows.

**Independent Test**: Can be tested by creating a new workflow in `chat-ci` and verifying it is inherited by other repositories. CI repository delivers value by providing reusable workflow definitions.

**Acceptance Scenarios**:

1. **Given** a reusable workflow exists in `chat-ci`, **When** another repository references it, **Then** the workflow executes with the calling repository's context
2. **Given** a CI workflow is updated in `chat-ci`, **When** dependent repositories run their pipelines, **Then** they automatically use the updated workflow without code changes
3. **Given** a new repository is created, **When** it references `chat-ci` workflows, **Then** it inherits standard build/test/deploy patterns without custom configuration

---

### User Story 4 - Dedicated UI Testing (Priority: P4)

As a QA engineer, I want end-to-end UI tests in a dedicated repository so that I can run comprehensive integration tests against deployed environments without coupling test code to frontend implementation details.

**Why this priority**: Separating E2E tests enables independent test maintenance, allows tests to run against any environment (staging, production), and enables AI-assisted testing via Playwright MCP without impacting frontend build times.

**Independent Test**: Can be tested by running `chat-ui` tests against a deployed staging environment. UI test repository delivers value by validating full user journeys across frontend and backend.

**Acceptance Scenarios**:

1. **Given** frontend and backend are deployed, **When** E2E tests run from `chat-ui`, **Then** all user journeys are validated end-to-end
2. **Given** an E2E test fails, **When** investigating, **Then** the failure is isolated to the test repository without affecting frontend or backend pipelines
3. **Given** Playwright MCP is configured, **When** tests execute, **Then** AI-assisted interactions are available for complex test scenarios

---

### User Story 5 - Infrastructure as Code (Priority: P5)

As an infrastructure engineer, I want cloud resource definitions in a dedicated repository so that I can manage, version, and audit infrastructure changes separately from application code.

**Why this priority**: Separating infrastructure enables proper change management, security reviews, and audit trails for cloud resources. Infrastructure changes have different risk profiles than application changes and benefit from separate approval workflows.

**Independent Test**: Can be tested by reviewing infrastructure definitions and validating they match deployed resources. Infrastructure repository delivers value by documenting and automating cloud resource provisioning.

**Acceptance Scenarios**:

1. **Given** infrastructure definitions exist in `chat-infra`, **When** applied, **Then** cloud resources are created/updated to match the definitions
2. **Given** an infrastructure change is proposed, **When** reviewed, **Then** the change is visible and auditable without application code noise
3. **Given** a new environment is needed, **When** infrastructure definitions are applied with environment parameters, **Then** the complete environment is provisioned

---

### Edge Cases

- What happens when shared types are updated? All dependent repositories must be updated and tested before deployment.
- How does the system handle API version mismatches between frontend and backend? CI validates API contract compatibility before deployment; backend maintains backward-compatible versions.
- What happens if centralized CI workflows fail? Individual repositories must have clear error messaging indicating the source of failure.
- How are cross-repository dependencies tracked? Dependency graph must be documented and automated checks must prevent breaking changes.

## Requirements *(mandatory)*

### Functional Requirements

**Repository Structure**

- **FR-001**: System MUST support five separate repositories: `chat-backend`, `chat-frontend`, `chat-infra`, `chat-ui`, and `chat-ci`
- **FR-002**: Each repository MUST be independently cloneable, buildable, and testable
- **FR-003**: Repositories MUST NOT contain duplicate source code (shared code extracted to packages)

**Shared Code Management**

- **FR-004**: Common type definitions MUST be extracted to a shared package accessible by frontend and backend
- **FR-005**: API contracts MUST be documented in a format consumable by both frontend and backend
- **FR-006**: Shared packages MUST be versioned independently from application repositories

**CI/CD Requirements**

- **FR-007**: `chat-ci` MUST contain reusable GitHub Actions workflows
- **FR-008**: Application repositories MUST inherit workflows from `chat-ci` using GitHub's reusable workflow feature
- **FR-009**: Each repository MUST have its own CI pipeline that triggers on commits to that repository
- **FR-010**: Deployment pipelines MUST support environment-specific configurations (development, staging, production)
- **FR-010a**: CI pipelines MUST validate API contract compatibility before allowing frontend deployment against a backend version
- **FR-010b**: Backend MUST maintain backward-compatible API versions to enable independent frontend deployment cycles

**Backend Repository**

- **FR-011**: `chat-backend` MUST contain all server-side code, database migrations, and API route definitions
- **FR-012**: Backend MUST be deployable independently without frontend
- **FR-013**: Backend MUST expose health check endpoints for deployment verification

**Frontend Repository**

- **FR-014**: `chat-frontend` MUST contain all client-side code, components, and static assets
- **FR-015**: Frontend MUST build as static files deployable to any static hosting service
- **FR-016**: Frontend MUST support configurable backend API URL via environment variables

**UI Test Repository**

- **FR-017**: `chat-ui` MUST contain all end-to-end Playwright tests
- **FR-018**: UI tests MUST be runnable against any deployed environment via configuration
- **FR-019**: UI tests MUST integrate with Playwright MCP for AI-assisted test interactions

**Infrastructure Repository**

- **FR-020**: `chat-infra` MUST contain all cloud resource definitions
- **FR-021**: Infrastructure definitions MUST support multiple environments
- **FR-022**: Infrastructure changes MUST be auditable through version control history

**Migration Requirements**

- **FR-023**: Migration MUST preserve git history for moved files where feasible
- **FR-024**: Migration MUST not cause service downtime
- **FR-025**: Migration MUST maintain backward compatibility during transition period
- **FR-026**: Migration MUST support parallel operation where both monorepo and split repositories remain functional, enabling instant rollback if issues arise

### Key Entities

- **Repository**: A git repository containing source code, configuration, and CI/CD definitions for a specific concern (backend, frontend, infra, ui-tests, ci)
- **Shared Package**: A versioned code package containing types, contracts, or utilities used by multiple repositories
- **Reusable Workflow**: A GitHub Actions workflow defined in one repository and callable from other repositories
- **Environment**: A deployment target (development, staging, production) with specific configuration values
- **API Contract**: A formal specification of the interface between frontend and backend including endpoints, request/response types, and error codes

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All five repositories can be cloned and built independently within 5 minutes each
- **SC-002**: Backend deployment completes in under 10 minutes from commit to live
- **SC-003**: Frontend deployment completes in under 5 minutes from commit to live
- **SC-004**: CI/CD pipeline changes in `chat-ci` propagate to dependent repositories within 1 workflow run
- **SC-005**: UI test suite executes against a deployed environment in under 15 minutes
- **SC-006**: Shared type package updates are consumable by dependent repos within 1 version bump
- **SC-007**: Zero service downtime during migration from monorepo to split repositories
- **SC-008**: Developer onboarding time (clone to first successful test run) remains under 10 minutes per repository
- **SC-009**: 100% of existing functionality preserved after migration (all current tests pass)
- **SC-010**: Infrastructure provisioning for a new environment completes in under 30 minutes

## Clarifications

### Session 2026-02-04

- Q: Where will shared packages be hosted? → A: GitHub Packages (npm registry within GitHub organization)
- Q: What is the migration rollback strategy? → A: Parallel operation period (both monorepo and split repos functional during transition)
- Q: How will cross-repository deployments be coordinated? → A: API version contracts with compatibility checks in CI

## Assumptions

- GitHub is the source control and CI/CD platform for all repositories
- Shared packages will be published to GitHub Packages npm registry within the organization
- GitHub Actions reusable workflows feature is available and sufficient for centralized CI needs
- Google Cloud Platform remains the deployment target (Cloud Run for backend, GCS for frontend)
- Existing Playwright test infrastructure is compatible with MCP integration
- Team has permissions to create new GitHub repositories and configure cross-repo workflow access
- npm or similar package registry is available for publishing shared packages (can be GitHub Packages)
- Current API surface is stable enough that contract extraction is feasible without major refactoring

## Dependencies

- GitHub organization must allow reusable workflows across repositories
- Package registry access for shared packages (GitHub Packages or npm)
- GCP project permissions for infrastructure changes
- Current test suites must pass before migration begins
