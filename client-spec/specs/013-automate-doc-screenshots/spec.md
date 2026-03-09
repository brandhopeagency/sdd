# Feature Specification: Automated Documentation Screenshots & Content Enhancement

**Feature Branch**: `013-automate-doc-screenshots`
**Created**: 2026-02-22
**Status**: Complete
**Jira Epic**: [MTB-251](https://mentalhelpglobal.atlassian.net/browse/MTB-251)
**Input**: User description: "Always use Playwright MCP on dev to generate screenshots in dev for documentation. Make all documentation more detailed. Transition Jira tasks along the implementation."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Automated Screenshot Capture via Playwright (Priority: P1)

When documentation pages in Confluence require screenshots (such as the
User Manual), the documentation author uses the Playwright MCP to
navigate the deployed dev environment, interact with the UI to reach
the desired screen state, capture a screenshot, and embed it in the
corresponding Confluence page — replacing any existing `[SCREENSHOT]`
placeholders.

**Why this priority**: Screenshots are the most visible gap in the
current documentation. The User Manual pages have `[SCREENSHOT: ...]`
placeholders that reduce usability. Automating capture via Playwright
eliminates the manual bottleneck and ensures screenshots are always
reproducible.

**Independent Test**: Can be verified by navigating to any User Manual
page in Confluence and confirming that all `[SCREENSHOT]` placeholders
have been replaced with actual images captured from the dev environment.

**Acceptance Scenarios**:

1. **Given** a User Manual page in Confluence contains a
   `[SCREENSHOT: Login screen with email field]` placeholder, **When**
   the documentation author runs the Playwright MCP to navigate to the
   dev login page and captures a screenshot, **Then** the placeholder is
   replaced with an inline image showing the current dev login screen.

2. **Given** the dev environment UI has been updated with new styling,
   **When** the Playwright MCP captures fresh screenshots of affected
   pages, **Then** the Confluence documentation reflects the updated UI
   without manual intervention.

3. **Given** a documentation page requires a screenshot of a state that
   needs interaction (e.g., an open dropdown, a filled form), **When**
   the Playwright MCP navigates to the page and performs the required
   interactions before capturing, **Then** the screenshot shows the
   correct interactive state.

---

### User Story 2 - Enrich User Manual with Detailed Content (Priority: P2)

End users reading the User Manual find comprehensive, self-service
guides that cover every interactive element, include numbered
step-by-step workflows, tips for common mistakes, and screenshots for
each major step — so they can accomplish any task without needing to ask
for help.

**Why this priority**: The initial User Manual pages were created with
foundational content and placeholders. Enriching them to the detail
standard defined in Constitution Principle XI ensures users can
self-serve effectively, reducing support burden.

**Independent Test**: Have a new end user attempt to complete a key
workflow (e.g., first login, starting a chat, reviewing a session)
using only the User Manual. They should succeed without external help.

**Acceptance Scenarios**:

1. **Given** the Getting Started page exists in Confluence, **When** a
   new user reads it, **Then** it includes: purpose of the login
   screen, step-by-step login with OTP, explanation of every element on
   the landing page, and at least one Playwright-captured screenshot per
   major step.

2. **Given** the Workbench Guide page exists, **When** an administrator
   reads it, **Then** each section (Users, Groups, Sessions, Settings)
   includes: how to reach the section, what every button and control
   does, a numbered workflow for the primary task, tips for common
   mistakes, and at least one screenshot.

3. **Given** any User Manual page, **When** reviewed against the
   documentation detail standard, **Then** it covers: purpose of the
   screen, how to reach it, every interactive element, numbered
   workflows, and tips/warnings.

---

### User Story 3 - Enrich Non-Technical Onboarding with Detailed Content (Priority: P3)

Non-technical team members reading the Non-Technical Onboarding section
find sufficiently detailed content that they can understand the product,
its terminology, key workflows, and navigation without needing a live
walkthrough.

**Why this priority**: Non-Technical Onboarding pages have foundational
content but need more detail to meet the self-service documentation
standard. These pages are lower priority than the User Manual because
non-technical team members typically receive some live onboarding.

**Independent Test**: Have a new project manager or support staff member
read through the Non-Technical Onboarding section and successfully
explain the product's purpose, key terms, and user workflows to a
colleague — without having received any live walkthrough.

**Acceptance Scenarios**:

1. **Given** the Product Overview page exists, **When** a new PM reads
   it, **Then** it includes detailed descriptions of each user type,
   real examples of how they use the platform, and enough context to
   understand the product's value proposition.

2. **Given** the Key Terminology page exists, **When** a support staff
   member consults it, **Then** every term includes a clear definition,
   context for when the term is encountered, and an example of its use.

3. **Given** the User Workflows page exists, **When** a stakeholder
   reads it, **Then** each workflow narrative includes enough detail
   to understand the complete user journey with all decision points.

---

### User Story 4 - Enrich Technical Onboarding with Detailed Content (Priority: P4)

New developers reading the Technical Onboarding section find
comprehensive setup instructions with concrete commands, expected
outputs, troubleshooting steps, and architecture context — so they
can set up their environment and start contributing without asking
existing team members.

**Why this priority**: Technical Onboarding pages have foundational
content but the detail standard requires concrete commands, expected
outputs, and troubleshooting for every procedure. This is the lowest
priority because developers have access to per-repo CLAUDE.md files
as a supplementary reference.

**Independent Test**: Have a new developer follow the Technical
Onboarding section to set up their local environment from scratch,
verifying they can run the application without needing to ask for
missing steps.

**Acceptance Scenarios**:

1. **Given** the Local Development Setup page exists, **When** a new
   developer follows it, **Then** every step includes the exact
   command to run, the expected output, and what to do if the output
   differs.

2. **Given** the Architecture Overview page exists, **When** a new
   developer reads it, **Then** they understand the data flow between
   all system components and can identify which repository handles
   any given concern.

3. **Given** the Debugging Guide page exists, **When** a developer
   encounters a common issue (OTP, CORS, DB connection), **Then** the
   guide provides a step-by-step diagnostic path with expected
   observations at each step.

---

### Edge Cases

- What happens when the dev environment is temporarily unavailable
  during a screenshot capture run? The capture MUST be retried after
  the environment is restored; documentation updates are deferred but
  not skipped.

- What happens when a Confluence page already has an image where a
  placeholder used to be? The existing image MUST be replaced with the
  freshly captured screenshot to ensure currency.

- What happens when the Playwright MCP cannot reach a specific UI state
  (e.g., a feature behind a permission wall)? The screenshot task for
  that state MUST be flagged for manual capture, and the page MUST
  document which screenshots are manually maintained.

- What happens when the dev UI significantly differs from production?
  Dev screenshots are the standard per Constitution Principle XI.
  Differences are acceptable as dev represents the latest state.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: All User Manual screenshots MUST be captured using the
  Playwright MCP against the deployed dev environment.

- **FR-002**: The Playwright MCP MUST navigate to the relevant page,
  perform any required interactions to reach the desired UI state, and
  capture a screenshot.

- **FR-003**: Captured screenshots MUST be uploaded to Confluence as
  page attachments via the Confluence REST API
  (`POST /rest/api/content/{pageId}/child/attachment`) and embedded
  inline using Confluence storage-format `<ri:attachment>` references
  — not `<ri:url>` references. The Atlassian MCP does not support
  attachment uploads; the REST API with an Atlassian API token
  (Basic Auth) is required. Markdown image syntax
  (`![alt](filename.png)`) MUST NOT be used for page attachments
  because the MCP's markdown-to-storage converter produces `<ri:url>`
  elements that reference external URLs instead of page attachments.

- **FR-004**: Each User Manual guide page MUST include: purpose of the
  screen, how to reach it, every interactive element and its effect,
  numbered step-by-step workflows, and tips or warnings for common
  mistakes.

- **FR-005**: Each Non-Technical Onboarding page MUST provide sufficient
  detail for a reader to understand the topic without a live
  walkthrough. Definitions MUST include context and usage examples.

- **FR-006**: Each Technical Onboarding page MUST include concrete
  commands, expected outputs, and troubleshooting steps for every
  procedure described.

- **FR-007**: Release Notes entries MUST include enough detail for users
  to understand the impact of each change.

- **FR-008**: No documentation page MUST contain placeholder or skeleton
  content when the feature is considered complete.

### Key Entities

- **Screenshot**: A PNG image file captured by the Playwright MCP from
  the dev environment using `browser_run_code` with an explicit
  absolute file path (`page.screenshot({ path: '...' })`). Uploaded
  to Confluence as a page attachment via the REST API, and embedded
  inline using `<ac:image><ri:attachment ri:filename="..." /></ac:image>`
  storage-format markup. Associated with a specific page, a UI state
  description, and a capture date. The standard
  `browser_take_screenshot` tool saves files to the MCP process's
  working directory which may be inaccessible; `browser_run_code`
  with an explicit path is the reliable alternative.

- **Documentation Page**: A Confluence page in one of the four
  documentation sections, with a defined audience, content scope, and
  detail standard.

## Assumptions

- The dev environment is deployed and accessible via a public URL at
  the time of screenshot capture.

- The Playwright MCP (`plugin-playwright-playwright`) is enabled and
  can navigate web pages, interact with elements, and capture
  screenshots.

- An account with appropriate permissions (client, therapist,
  administrator roles) is available in the dev environment for
  capturing role-specific screenshots.

- For OTP login in dev, the OTP code is retrievable from the browser
  console or backend logs.

- The existing Confluence page structure from 012-confluence-documentation
  remains intact and all page IDs are current.

- An Atlassian API token is available for authenticating REST API calls
  to upload page attachments. The token is used with Basic Auth
  (`email:token` base64-encoded).

- The Playwright MCP's `browser_take_screenshot` tool saves files
  relative to the MCP server process's working directory, which may
  not be the workspace root. To save screenshots to a known location,
  `browser_run_code` with `page.screenshot({ path: '<absolute>' })`
  must be used instead.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of `[SCREENSHOT]` placeholders in User Manual pages
  are replaced with actual Playwright-captured images from the dev
  environment.

- **SC-002**: Every User Manual guide page covers all five detail
  criteria: purpose, navigation path, interactive elements, numbered
  workflows, and tips/warnings.

- **SC-003**: A new non-technical team member can understand the
  product's purpose, key terms, and workflows by reading only the
  Non-Technical Onboarding section — without a live walkthrough.

- **SC-004**: A new developer can set up their local environment by
  following only the Technical Onboarding section — without asking
  existing team members for missing steps.

- **SC-005**: Zero documentation pages contain placeholder text,
  skeleton content, or `[SCREENSHOT]` markers when all tasks are
  complete.
