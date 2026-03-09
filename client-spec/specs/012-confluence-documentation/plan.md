# Implementation Plan: Confluence Documentation Framework

**Branch**: `012-confluence-documentation` | **Date**: 2026-02-22 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/012-confluence-documentation/spec.md`

## Summary

Establish four documentation sections in the existing Confluence
`User Documentation` space (key: `UD`): Release Notes, User Manual,
Non-Technical Onboarding, and Technical Onboarding. All pages will be
created programmatically via the Atlassian MCP. No application code
changes are required — this is a documentation-only feature.

## Technical Context

**Language/Version**: N/A (documentation-only; no application code)
**Primary Dependencies**: Atlassian Confluence Cloud, Atlassian MCP
(`plugin-atlassian-atlassian`)
**Storage**: Confluence cloud (space key `UD`, space ID `8454147`)
**Testing**: Manual content review; no automated tests
**Target Platform**: Confluence web
(https://mentalhelpglobal.atlassian.net/wiki/spaces/UD)
**Project Type**: Documentation / process
**Performance Goals**: N/A
**Constraints**: Pages must use Markdown content format via
`createConfluencePage` with `contentFormat: "markdown"`; screenshots
uploaded manually as attachments
**Scale/Scope**: 4 section root pages + ~15 initial content pages

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [X] Spec-first workflow is preserved (`spec.md` → `plan.md` →
      `tasks.md` → implementation)
- [N/A] Affected split repositories are explicitly listed with per-repo
      file paths — **No split repos are affected; this is a
      Confluence-only feature** (see Complexity Tracking)
- [N/A] Test strategy aligns with each target repository conventions —
      **No code tests; validation is manual content review**
- [N/A] Integration strategy enforces PR-only merges into `develop` —
      **No code merges; Confluence pages are created directly**
- [N/A] Required approvals and required CI checks are identified —
      **No code PRs**
- [N/A] Post-merge hygiene is defined — **No feature branches in split
      repos**
- [N/A] For user-facing changes, responsive and PWA compatibility
      checks are defined — **Not a UI code feature**
- [N/A] Post-deploy smoke checks are defined — **No deployment**
- [X] Jira Epic exists for this feature with spec content in
      description; Jira issue key is recorded in spec.md header —
      **MTB-1**
- [X] Documentation impact is identified — **This feature IS the
      documentation framework setup. All four Confluence doc types
      (User Manual, Technical Onboarding, Release Notes, Non-Technical
      Onboarding) are being created.**

## Project Structure

### Documentation (this feature)

```text
specs/012-confluence-documentation/
├── plan.md              # This file
├── research.md          # Phase 0 output — Confluence space decisions
├── quickstart.md        # Phase 1 output — Page creation guide
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Confluence Space Structure (target)

```text
User Documentation (space: UD, homepage ID: 8454317)
├── Release Notes                          (section root)
│   └── Release <version> — <YYYY-MM-DD>   (one page per release)
├── User Manual                            (section root)
│   ├── Getting Started
│   ├── Chat Interface Guide
│   ├── Workbench Guide
│   └── FAQ
├── Non-Technical Onboarding               (section root)
│   ├── Product Overview
│   ├── Key Terminology
│   ├── User Workflows
│   └── Navigating the System
└── Technical Onboarding                   (section root)
    ├── Architecture Overview
    ├── Repository Structure
    ├── Local Development Setup
    ├── CI/CD Pipelines
    ├── Coding Conventions
    └── Debugging Guide
```

**Structure Decision**: No source code directories are affected. The
deliverable is a set of Confluence pages created via the Atlassian MCP
`createConfluencePage` tool. The speckit artifacts in `client-spec` are
the only repository files produced.

## Implementation Approach

### Atlassian MCP Parameters (shared across all page creation)

| Parameter | Value |
|-----------|-------|
| `cloudId` | `3aca5c6d-161e-42c2-8945-9c47aeb2966d` |
| `spaceId` | `8454147` |
| `contentFormat` | `markdown` |

### Phase 1: Space Homepage + Section Roots

1. **Update space homepage** (page ID `8454317`) to replace default
   boilerplate with an overview of the four documentation sections and
   links to each section root page.

2. **Create four section root pages** as children of the homepage:
   - `Release Notes` — overview + link to latest release
   - `User Manual` — overview + table of contents
   - `Non-Technical Onboarding` — overview + table of contents
   - `Technical Onboarding` — overview + table of contents

### Phase 2: Release Notes Content

3. **Create initial Release Notes entry** as a child of the
   `Release Notes` section root, using the standardized format:
   - Title: `Release <version> — <YYYY-MM-DD>`
   - Body: Version, Date, What's New, Known Issues, Related Epics

### Phase 3: User Manual Content

4. **Create User Manual child pages**:
   - `Getting Started` — account creation, first login, OTP flow
   - `Chat Interface Guide` — starting a session, sending messages,
     conversation history
   - `Workbench Guide` — admin overview, user management, group
     management, session review, settings
   - `FAQ` — common questions and answers

Screenshots will be added manually after initial page creation.

### Phase 4: Non-Technical Onboarding Content

5. **Create Non-Technical Onboarding child pages**:
   - `Product Overview` — what the platform does, who it serves
   - `Key Terminology` — glossary of product terms (chat, workbench,
     session, group, space, review)
   - `User Workflows` — high-level description of key user journeys
   - `Navigating the System` — where to find things, UI orientation

### Phase 5: Technical Onboarding Content

6. **Create Technical Onboarding child pages**:
   - `Architecture Overview` — system diagram, tech stack summary
   - `Repository Structure` — split-repo layout with roles, links to
     per-repo CLAUDE.md / AGENTS.md files
   - `Local Development Setup` — prerequisites, environment variables,
     database setup, running locally
   - `CI/CD Pipelines` — GitHub Actions workflows, deployment flow
   - `Coding Conventions` — linting, formatting, testing standards
   - `Debugging Guide` — log locations, common issues, environment
     configs

### Content Sources

| Documentation Type | Primary Content Sources |
|---|---|
| Release Notes | Git tags, Jira Epics, PR merge history |
| User Manual | Production UI exploration, existing product knowledge |
| Non-Technical Onboarding | Product overview docs, stakeholder interviews |
| Technical Onboarding | `chat-backend/CLAUDE.md`, `chat-frontend/package.json`, `chat-ui/CLAUDE.md`, `chat-infra/CLAUDE.md`, `chat-ci/README.md`, `chat-types/package.json` |

## Complexity Tracking

> **Constitution Check violations justified below**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| No split repos affected (Principles II, IV, VII) | This is a documentation-only feature; deliverables are Confluence pages, not code | Adding code changes would be scope creep for a content feature |
| No automated tests (Principle III) | Content quality is validated manually; no code to test | Automated content validation would require custom tooling out of scope |
| No PR-only integration (Principle IV) | Confluence pages are created directly via MCP; no git branches in split repos | Git-based doc workflow would duplicate Confluence's native versioning |
| No responsive/PWA checks (Principle IX) | No UI code changes | N/A |
| No post-deploy smoke checks (Principle VIII) | No deployment pipeline involved | N/A |
