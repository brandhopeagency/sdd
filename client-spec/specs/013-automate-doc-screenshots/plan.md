# Implementation Plan: Automated Documentation Screenshots & Content Enhancement

**Branch**: `013-automate-doc-screenshots` | **Date**: 2026-02-22 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/013-automate-doc-screenshots/spec.md`

## Summary

Replace all `[SCREENSHOT: ...]` placeholders in Confluence User Manual
pages with actual screenshots captured via the Playwright MCP against
the deployed dev environment. Enrich all four Confluence documentation
sections (User Manual, Non-Technical Onboarding, Technical Onboarding,
Release Notes) to meet the self-service documentation detail standard
defined in Constitution Principle XI.

## Technical Context

**Language/Version**: N/A — no application code; content authoring only
**Primary Dependencies**: Atlassian MCP (`plugin-atlassian-atlassian`),
Playwright MCP (`plugin-playwright-playwright`)
**Storage**: Confluence Cloud (space `UD`, spaceId `8454147`)
**Testing**: Manual content review and navigation validation
**Target Platform**: Confluence Cloud pages (web)
**Project Type**: Documentation-only — no source code changes
**Performance Goals**: N/A
**Constraints**:
- Atlassian MCP has no attachment upload tool; screenshots must be
  uploaded via the Confluence REST API (`POST /rest/api/content/{pageId}/child/attachment`)
  using an Atlassian API token for Basic Auth
- Atlassian MCP's markdown-to-storage converter renders `![alt](file.png)`
  as `<ri:url>` (external URL reference) instead of `<ri:attachment>`
  (page attachment reference); page content must be updated in Confluence
  storage format directly via the REST API to embed page attachments correctly
- Playwright MCP's `browser_take_screenshot` saves to the MCP process's
  working directory which may be inaccessible; `browser_run_code` with
  `page.screenshot({ path: '<absolute>' })` is required for reliable file access
**Scale/Scope**: ~19 existing Confluence pages to update; ~8–12
screenshots to capture from the dev environment

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [X] Spec-first workflow is preserved (`spec.md` → `plan.md` →
      `tasks.md` → implementation)
- [N/A] Affected split repositories are explicitly listed with per-repo
      file paths — *no split-repo changes; all work targets Confluence
      via MCP*
- [N/A] Test strategy aligns with each target repository conventions —
      *no code; validation is manual content review*
- [N/A] Integration strategy enforces PR-only merges into `develop`
      from feature/bugfix branches — *no source code merges*
- [N/A] Required approvals and required CI checks are identified for
      each target repo — *no repo CI involved*
- [N/A] Post-merge hygiene is defined — *no feature branches in split
      repos*
- [N/A] For user-facing changes, responsive and PWA compatibility
      checks are defined — *documentation pages, not application UI*
- [N/A] Post-deploy smoke checks are defined for critical routes — *no
      deployment; Confluence pages are published immediately on update*
- [X] Jira Epic exists for this feature with spec content in
      description; Jira issue key is recorded in spec.md header —
      **MTB-251**
- [X] Documentation impact is identified: this feature IS the
      documentation enhancement — all four Confluence doc types (User
      Manual, Technical Onboarding, Release Notes, Non-Technical
      Onboarding) are directly updated

## Project Structure

### Documentation (this feature)

```text
specs/013-automate-doc-screenshots/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output — key decisions
├── quickstart.md        # Phase 1 output — Playwright + Confluence procedures
├── checklists/
│   └── requirements.md  # Spec quality checklist (passed)
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

N/A — this feature does not modify any source code repositories. All
work is performed via:

- **Playwright MCP** (`plugin-playwright-playwright`): navigates the
  dev environment, interacts with UI elements, captures screenshots
- **Atlassian MCP** (`plugin-atlassian-atlassian`): reads and updates
  Confluence pages, manages Jira issues

**Structure Decision**: No source code structure needed. The feature
operates entirely through MCP tooling against external services
(Confluence Cloud and the deployed dev environment).

## Confluence Page Inventory

All pages were created by feature 012-confluence-documentation and
reside in Confluence space `UD` (spaceId `8454147`).

### Pages requiring screenshot capture (US1)

| Page | ID | Screenshots needed |
|------|----|--------------------|
| Getting Started | `8945665` | Login screen, OTP entry, landing page |
| Chat Interface Guide | `8847380` | New chat, messaging, conversation history |
| Workbench Guide | `8978433` | Admin overview, user/group management, session review, settings |

### Pages requiring content enrichment

| Page | ID | User Story | Current state |
|------|----|------------|---------------|
| Getting Started | `8945665` | US1 + US2 | Foundational content with `[SCREENSHOT]` placeholders |
| Chat Interface Guide | `8847380` | US1 + US2 | Foundational content with `[SCREENSHOT]` placeholders |
| Workbench Guide | `8978433` | US1 + US2 | Foundational content with `[SCREENSHOT]` placeholders |
| FAQ | `8814612` | US2 | Foundational content |
| Product Overview | `8749089` | US3 | Foundational content |
| Key Terminology | `8847399` | US3 | Foundational content |
| User Workflows | `9011367` | US3 | Foundational content |
| Navigating the System | `9043969` | US3 | Foundational content |
| Architecture Overview | `8781844` | US4 | Foundational content |
| Repository Structure | `8781863` | US4 | Foundational content |
| Local Development Setup | `8683524` | US4 | Foundational content |
| CI/CD Pipelines | `8978454` | US4 | Foundational content |
| Coding Conventions | `8749108` | US4 | Foundational content |
| Debugging Guide | `8978476` | US4 | Foundational content |
| Release v1.0.0 | `8880129` | US2 (Release Notes) | Template entry |

## Implementation Approach

### Phase order

1. **Screenshot capture** (US1): Use Playwright MCP to navigate the dev
   environment, interact to reach each required UI state, take
   screenshots. Save locally with descriptive filenames.

2. **User Manual enrichment** (US1 + US2): For each User Manual page,
   read current content via `getConfluencePage`, rewrite with detailed
   step-by-step workflows, interactive element descriptions,
   tips/warnings, and embed captured screenshots. Update via
   `updateConfluencePage`.

3. **Non-Technical Onboarding enrichment** (US3): Read each page,
   rewrite with detailed explanations, real examples, usage context.
   No screenshots needed (no code, no UI).

4. **Technical Onboarding enrichment** (US4): Read each page, rewrite
   with concrete commands, expected outputs, troubleshooting steps.
   Reference split-repo CLAUDE.md files for accuracy.

5. **Release Notes update** (US2): Enrich the initial Release v1.0.0
   entry with more detail. Template is already in place.

6. **Validation**: Review all pages against the detail standard, verify
   zero placeholders remain.

### Screenshot embedding strategy

See research.md for the full analysis and implementation findings.
The embedding pipeline has three distinct steps, each using a
different tool:

1. **Capture** — Use Playwright MCP `browser_run_code` with
   `page.screenshot({ path: '<absolute-path>.png' })` to save
   screenshots to a known local directory. Do NOT rely on
   `browser_take_screenshot` with a simple filename — the file may
   be saved to the MCP process's working directory which is not
   necessarily the workspace root or an accessible location.

2. **Upload** — Use `curl.exe` (Shell tool) to upload each screenshot
   as a Confluence page attachment via the REST API:
   ```
   POST /wiki/rest/api/content/{pageId}/child/attachment
   Authorization: Basic <email:token base64>
   X-Atlassian-Token: nocheck
   Content-Type: multipart/form-data
   Body: file=@<path-to-screenshot.png>
   ```

3. **Embed** — Update the page content in Confluence **storage format**
   (not markdown) to reference the uploaded attachment using:
   ```xml
   <ac:image ac:align="center" ac:layout="center">
     <ri:attachment ri:filename="screenshot-name.png" />
   </ac:image>
   ```
   This requires a REST API `PUT /wiki/rest/api/content/{pageId}`
   with `body.storage.value` containing the corrected storage-format
   markup and `body.storage.representation` set to `"storage"`.

**Critical constraint**: The Atlassian MCP's `updateConfluencePage`
tool with `contentFormat: "markdown"` converts `![alt](file.png)` to
`<ac:image><ri:url ri:value="file.png" /></ac:image>`, which
references an external URL rather than a page attachment. This is
why step 3 must use the REST API directly with storage format to
produce the correct `<ri:attachment>` element.

If the Atlassian API token is unavailable, fall back to descriptive
text placeholders and flag pages for manual attachment upload.

## Complexity Tracking

No Constitution Check violations requiring justification. All N/A items
are legitimately not applicable because this is a documentation-only
feature with no source code changes.
