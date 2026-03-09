# Feature Specification: Confluence Documentation Framework

**Feature Branch**: `012-confluence-documentation`
**Created**: 2026-02-22
**Status**: In Progress — 1 task remaining (production screenshot capture)
**Jira Epic**: [MTB-1](https://mentalhelpglobal.atlassian.net/browse/MTB-1)
**Input**: User description: "Define four documentation types (User Manual, Technical Onboarding, Release Notes, Non-Technical Onboarding) hosted in Confluence, updated on every production change."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Release Notes Published on Production Deploy (Priority: P1)

After a production release is deployed, the product team publishes a
user-friendly Release Notes entry in the Confluence `Release Notes`
section so that end users and stakeholders can see what changed and
when.

**Why this priority**: Release Notes are the only documentation type
required on every single production deployment. Establishing them first
creates the cadence and habit of production-triggered documentation
updates that all other documentation types depend on.

**Independent Test**: Can be fully tested by deploying a production
release and verifying a corresponding Release Notes page appears in
Confluence with the required fields (version, date, changes, known
issues, Jira Epic link).

**Acceptance Scenarios**:

1. **Given** a production release has been deployed with tagged `main`
   commit, **When** the release process completes, **Then** a Release
   Notes entry is published in the Confluence `Release Notes` section
   containing: release version/tag, date, list of user-visible changes,
   known issues (if any), and a link to the corresponding Jira Epic(s).

2. **Given** a Release Notes entry exists for a previous release,
   **When** a new production release is deployed, **Then** the new
   entry appears at the top of the Release Notes section in reverse
   chronological order, and previous entries remain unchanged.

3. **Given** a stakeholder wants to understand recent product changes,
   **When** they navigate to the Confluence `Release Notes` section,
   **Then** they see a clear, chronologically ordered list of all
   production releases with user-friendly descriptions (no technical
   jargon).

---

### User Story 2 - User Manual Maintained with Current Screenshots (Priority: P2)

End users (clients, therapists, administrators) access the Confluence
`User Manual` section to find step-by-step guidance for both the chat
interface and the workbench interface, with screenshots that match the
current production UI.

**Why this priority**: The User Manual directly reduces support burden
and enables self-service for end users. It is the second-highest impact
documentation type because outdated screenshots and instructions cause
confusion and support tickets.

**Independent Test**: Can be tested by verifying that the User Manual
section exists in Confluence, contains pages covering both chat and
workbench workflows, includes screenshots matching the current
production UI, and is written in non-technical language.

**Acceptance Scenarios**:

1. **Given** the User Manual section exists in Confluence, **When** an
   end user navigates to it, **Then** they find organized pages covering
   key workflows for both the chat interface and the workbench
   interface.

2. **Given** a production release includes UI changes to the chat or
   workbench interface, **When** the release is deployed, **Then** the
   affected User Manual pages are updated with new screenshots
   reflecting the current production UI.

3. **Given** the User Manual contains a step-by-step guide, **When** a
   non-technical user reads it, **Then** the language is free of
   developer terminology, code references, and internal system names
   that would not be meaningful to an end user.

4. **Given** a user is looking for help with a specific workflow,
   **When** they search or browse the User Manual, **Then** they can
   locate the relevant page within three navigation clicks from the
   section root.

---

### User Story 3 - Non-Technical Onboarding for Team Members (Priority: P3)

Non-technical team members (project managers, support staff,
stakeholders) access the Confluence `Non-Technical Onboarding` section
to understand the product, its workflows, key terminology, and how to
navigate the system — without needing developer-level context.

**Why this priority**: Non-technical onboarding enables faster ramp-up
for PMs, support staff, and new stakeholders. It has lower urgency than
the User Manual because these team members typically receive some live
onboarding, but having a maintained reference reduces repeated
explanations and knowledge silos.

**Independent Test**: Can be tested by having a new non-technical team
member follow the onboarding material and successfully navigate the
product's key workflows without developer assistance.

**Acceptance Scenarios**:

1. **Given** a new project manager joins the team, **When** they read
   the Non-Technical Onboarding section, **Then** they understand the
   product's purpose, target users, and core workflows without
   encountering code references, CLI commands, or implementation
   details.

2. **Given** the product adds a new user-facing workflow in a
   production release, **When** that release is deployed, **Then** the
   Non-Technical Onboarding section is updated to reflect the new
   workflow in plain language.

3. **Given** a support staff member needs to understand terminology used
   in the product, **When** they consult the Non-Technical Onboarding
   section, **Then** they find a glossary or explanation of key terms
   used in the chat and workbench interfaces.

---

### User Story 4 - Technical Onboarding for New Developers (Priority: P4)

New developers joining the project access the Confluence `Technical
Onboarding` section to understand the repository structure, local
environment setup, CI/CD pipelines, coding conventions, architecture
overview, and debugging guidance.

**Why this priority**: Technical onboarding is essential for developer
productivity but has the lowest urgency among the four documentation
types because much of this information already exists in per-repository
CLAUDE.md and AGENTS.md files. The Confluence section consolidates and
supplements this content in a discoverable location.

**Independent Test**: Can be tested by having a new developer follow the
Technical Onboarding guide to set up their local environment and
successfully run the application without needing to ask existing team
members for setup instructions.

**Acceptance Scenarios**:

1. **Given** a new developer joins the project, **When** they follow the
   Technical Onboarding section, **Then** they can set up their local
   development environment, understand the split-repository layout, and
   run the application locally.

2. **Given** the Technical Onboarding section references the
   split-repository architecture, **When** a developer reads it,
   **Then** they find an overview of each repository's role, links to
   per-repo CLAUDE.md/AGENTS.md files, and the CI/CD pipeline
   structure.

3. **Given** a change to repository structure, tooling, or development
   workflows is deployed, **When** that change reaches production,
   **Then** the Technical Onboarding section is updated to reflect the
   new structure or tooling.

4. **Given** a developer needs to debug an issue, **When** they consult
   the Technical Onboarding section, **Then** they find guidance on
   common debugging approaches, log locations, and environment-specific
   configurations.

---

### Edge Cases

- What happens when a production release contains no user-visible
  changes (e.g., backend-only performance improvements)? Release Notes
  MUST still be published, but the entry MAY note "No user-visible
  changes" with a summary of internal improvements.

- What happens when screenshots in the User Manual become outdated
  because a UI change was deployed without updating the manual?
  Documentation debt MUST be tracked and resolved before the next
  production release (per Constitution Principle XI).

- What happens when Confluence is temporarily unavailable during a
  production deploy? The documentation update obligation remains; the
  team MUST complete the updates once Confluence access is restored,
  before the next production release.

- What happens when multiple production releases occur in rapid
  succession? Each release MUST have its own Release Notes entry. User
  Manual and onboarding updates MAY be batched if releases are within
  the same business day, provided all updates are completed before the
  next business day.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Confluence space MUST contain a dedicated `Release
  Notes` section where each production release has its own page or
  entry.

- **FR-002**: Each Release Notes entry MUST include: release version/tag,
  deployment date, list of user-visible changes in plain language, known
  issues (if any), and a link to the corresponding Jira Epic(s).

- **FR-003**: Release Notes entries MUST be ordered in reverse
  chronological order (newest first).

- **FR-004**: The Confluence space MUST contain a dedicated `User Manual`
  section with pages covering key workflows for both the chat and
  workbench interfaces.

- **FR-005**: User Manual pages MUST include system screenshots that
  reflect the current production UI state.

- **FR-006**: User Manual content MUST be written in non-technical
  language accessible to all end-user roles (clients, therapists,
  administrators).

- **FR-007**: The Confluence space MUST contain a dedicated
  `Non-Technical Onboarding` section covering product overview, user
  workflows, key terminology, and system navigation guidance.

- **FR-008**: Non-Technical Onboarding content MUST NOT contain code
  references, CLI commands, or implementation details.

- **FR-009**: The Confluence space MUST contain a dedicated `Technical
  Onboarding` section covering repository structure, local environment
  setup, CI/CD pipelines, coding conventions, architecture overview,
  and debugging guidance.

- **FR-010**: Technical Onboarding MUST reference the split-repository
  layout and link to per-repo CLAUDE.md / AGENTS.md files.

- **FR-011**: Every production release MUST trigger updates to Release
  Notes (always), User Manual (if UI changed), and Non-Technical
  Onboarding (if workflows changed).

- **FR-012**: Technical Onboarding MUST be updated when repository
  structure, tooling, or development workflows change.

- **FR-013**: Documentation debt (outdated pages) MUST be tracked and
  resolved before the next production release.

### Key Entities

- **Documentation Type**: One of four defined categories (User Manual,
  Technical Onboarding, Release Notes, Non-Technical Onboarding), each
  with a target audience, scope, content guidelines, and a designated
  Confluence section.

- **Release Notes Entry**: A single record of a production release
  including version, date, changes, known issues, and Jira Epic
  reference. One entry per production deployment.

- **Documentation Page**: A Confluence page within one of the four
  sections, containing text, screenshots (for User Manual), and
  navigation structure. Subject to update triggers defined per
  documentation type.

## Assumptions

- The team has an existing Confluence space for the Mental Health Global
  project. If not, one will be created as part of this feature's
  implementation.

- Confluence access is available to all team members who need to read or
  author documentation (end users, developers, PMs, support staff).

- Screenshots for the User Manual will be captured manually from the
  production environment after each relevant UI deployment.

- The split-repository CLAUDE.md and AGENTS.md files remain the
  canonical developer reference for repository-specific conventions;
  Technical Onboarding in Confluence supplements but does not replace
  them.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of production releases have a corresponding Release
  Notes entry published in Confluence within 24 hours of deployment.

- **SC-002**: New non-technical team members can understand the
  product's core workflows within their first day by reading the
  Non-Technical Onboarding section, without requiring live walkthrough
  sessions.

- **SC-003**: End users can find guidance for any primary chat or
  workbench workflow in the User Manual within three navigation clicks
  from the section root.

- **SC-004**: New developers can set up their local development
  environment by following the Technical Onboarding section without
  needing to ask existing team members for missing setup steps.

- **SC-005**: All User Manual screenshots reflect the current production
  UI — no screenshot is more than one production release behind.

- **SC-006**: Zero documentation sections contain code references, CLI
  commands, or developer jargon in the User Manual or Non-Technical
  Onboarding sections.
