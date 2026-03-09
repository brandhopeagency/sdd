# Research: Confluence Documentation Framework

**Feature**: 012-confluence-documentation
**Date**: 2026-02-22

## R1. Confluence Space Strategy

**Decision**: Use the existing `User Documentation` space (key: `UD`,
ID: `8454147`) for all four documentation types.

**Rationale**: A single space simplifies permissions management and
provides one navigation entry point for all audiences. The four
documentation types become top-level sections (child pages under the
space homepage) rather than separate spaces.

**Alternatives considered**:
- **Separate spaces per doc type**: Rejected — adds administration
  overhead, fragments navigation, and complicates cross-referencing.
  Confluence permissions can be managed at page level if needed.
- **New space alongside existing**: Rejected — the `User Documentation`
  space already exists and is named appropriately.

## R2. Page Hierarchy and Navigation

**Decision**: Use a three-level hierarchy:
1. Space homepage (overview + links to four sections)
2. Section root pages (one per doc type)
3. Content pages (individual topics under each section)

```text
User Documentation Home (homepage — ID: 8454317)
├── Release Notes (section root)
│   ├── Release v1.2.0 — 2026-02-20
│   ├── Release v1.1.0 — 2026-02-10
│   └── ...
├── User Manual (section root)
│   ├── Getting Started
│   ├── Chat Interface Guide
│   ├── Workbench Guide
│   └── FAQ
├── Non-Technical Onboarding (section root)
│   ├── Product Overview
│   ├── Key Terminology
│   ├── User Workflows
│   └── Navigating the System
└── Technical Onboarding (section root)
    ├── Architecture Overview
    ├── Repository Structure
    ├── Local Development Setup
    ├── CI/CD Pipelines
    ├── Coding Conventions
    └── Debugging Guide
```

**Rationale**: Three levels keeps navigation shallow (≤3 clicks per
spec requirement SC-003) while providing logical grouping. The homepage
serves as an index.

**Alternatives considered**:
- **Flat page list**: Rejected — becomes unnavigable with more than
  ~10 pages.
- **Deeper nesting (4+ levels)**: Rejected — violates the 3-click
  navigation requirement from the spec.

## R3. Content Format

**Decision**: Use Markdown for page content via the Atlassian MCP
`createConfluencePage` tool with `contentFormat: "markdown"`.

**Rationale**: Markdown is supported by the Confluence API and is the
natural format for speckit workflows. It renders correctly in
Confluence and allows programmatic page creation.

**Alternatives considered**:
- **Atlassian Document Format (ADF)**: Rejected for initial creation —
  ADF is verbose JSON and harder to author/maintain. Can be used for
  complex layouts later if needed.
- **Manual editing only**: Rejected — programmatic creation via MCP
  ensures consistency and enables automation.

## R4. Screenshot Strategy for User Manual

**Decision**: Screenshots will be captured manually from the production
environment and uploaded as Confluence page attachments. Each screenshot
will be referenced inline in the User Manual pages.

**Rationale**: The production UI is the source of truth. Manual capture
ensures accuracy. Automated screenshot tooling (e.g., Playwright) could
be explored later but is out of scope for initial setup.

**Alternatives considered**:
- **Automated Playwright screenshots**: Rejected for MVP — adds
  complexity and CI pipeline work. Can be added as a future
  enhancement.
- **External image hosting**: Rejected — Confluence attachments keep
  screenshots co-located with documentation and under the same access
  controls.

## R5. Release Notes Entry Format

**Decision**: Each production release gets its own child page under the
`Release Notes` section root, titled with the pattern:
`Release <version> — <YYYY-MM-DD>`.

Each entry contains:
- **Version**: Git tag / release version
- **Date**: Deployment date
- **What's New**: Bullet list of user-visible changes
- **Known Issues**: Any unresolved issues (or "None")
- **Related Epics**: Links to Jira Epic(s) included in this release

**Rationale**: One page per release keeps entries self-contained,
searchable, and independently linkable. Reverse chronological ordering
is achieved by Confluence's page order or by sorting child pages by
creation date descending.

## R6. Documentation Update Process

**Decision**: Documentation updates are a mandatory step in the
production release checklist (Constitution Principle XI). The speckit
`/speckit.implement` command includes a documentation update step
(step 10) that checks which Confluence sections need updates.

**Rationale**: Integrating documentation into the existing release
workflow ensures updates are not forgotten. The constitution compliance
check treats missing documentation updates as non-compliant.

## R7. Implementation Approach

**Decision**: Implementation is Confluence-only — no application code
changes are needed. The work consists of:
1. Restructuring the existing space homepage
2. Creating four section root pages
3. Populating initial content pages under each section
4. Establishing Release Notes template content

All page creation will use the Atlassian MCP `createConfluencePage`
tool programmatically.

**Rationale**: This feature is a documentation/process feature, not a
code feature. The Atlassian MCP provides the tooling to create pages
programmatically, ensuring consistency.
