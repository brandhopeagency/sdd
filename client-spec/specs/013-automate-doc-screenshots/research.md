# Research: Automated Documentation Screenshots & Content Enhancement

**Feature**: 013-automate-doc-screenshots
**Date**: 2026-02-22

## Decision 1: Screenshot capture workflow

**Decision**: Use the Playwright MCP (`plugin-playwright-playwright`) to
navigate the deployed dev environment, interact with the UI to reach
each required state, and capture screenshots with `browser_take_screenshot`.

**Rationale**: The Playwright MCP provides all the primitives needed for
automated screenshot capture: `browser_navigate` to go to URLs,
`browser_click` / `browser_fill_form` / `browser_type` to interact with
elements, `browser_snapshot` to inspect the DOM for element references,
and `browser_take_screenshot` to save images. This aligns with
Constitution Principle XI which mandates Playwright MCP for screenshots.

**Alternatives considered**:
- Manual screenshot capture from production: Rejected — Constitution
  v3.6.0 explicitly prohibits requiring manual production screenshots;
  dev screenshots are the standard.
- Playwright E2E tests in `chat-ui`: Rejected — adds unnecessary test
  infrastructure complexity. The MCP tools provide the same capability
  interactively.

## Decision 2: Screenshot embedding in Confluence

**Decision**: Embed screenshots as Confluence page attachments,
referenced in page content using Confluence storage-format
`<ri:attachment>` elements. The embedding pipeline has three steps:

1. **Upload** each screenshot file as a page attachment via the
   Confluence REST API v1:
   ```
   POST https://{site}/wiki/rest/api/content/{pageId}/child/attachment
   Authorization: Basic <email:apiToken base64>
   X-Atlassian-Token: nocheck
   Content-Type: multipart/form-data
   Form field: file=@<path-to-file.png>
   ```
   Use `curl.exe` (not PowerShell `Invoke-RestMethod`, which returns
   500 errors for multipart attachment uploads to Confluence).

2. **Retrieve** the page's current content in storage format via:
   ```
   GET https://{site}/wiki/rest/api/content/{pageId}?expand=body.storage,version
   ```

3. **Update** the page content by replacing any `<ri:url>` image
   references with `<ri:attachment>` references in the storage-format
   body, then PUT back:
   ```
   PUT https://{site}/wiki/rest/api/content/{pageId}
   Content-Type: application/json
   Body: {
     "version": { "number": <current+1> },
     "title": "<page title>",
     "type": "page",
     "body": {
       "storage": {
         "value": "<corrected storage format>",
         "representation": "storage"
       }
     }
   }
   ```

**Rationale**: The Atlassian MCP (`plugin-atlassian-atlassian`) provides
tools for reading and updating Confluence page content but does NOT
include an attachment upload tool. This is a known limitation.

**Implementation findings** (discovered during execution):

- **Markdown image syntax does not embed attachments**: The MCP's
  `updateConfluencePage` with `contentFormat: "markdown"` converts
  `![alt text](filename.png)` into `<ac:image><ri:url ri:value="filename.png" /></ac:image>`.
  The `<ri:url>` element references an external URL, not a page
  attachment. Images appear broken because `filename.png` is not
  a valid URL.

- **Alt text parsing is fragile**: The markdown parser sometimes
  extracts words from the alt text and places them in the `ac:src`
  attribute instead of the filename (e.g., `ac:src="English,"` or
  `ac:src="View"` when the alt text contained those words). This
  further corrupts the image reference.

- **The correct storage-format element for page attachments**:
  ```xml
  <ac:image ac:align="center" ac:layout="center">
    <ri:attachment ri:filename="screenshot-name.png" />
  </ac:image>
  ```
  This must be written via the REST API using `representation: "storage"`,
  not through the MCP's markdown interface.

- **PowerShell `Invoke-RestMethod` fails for multipart uploads**:
  Returns HTTP 500 when posting multipart/form-data to the Confluence
  attachment endpoint. `curl.exe` handles this correctly.

- **REST API v1 vs v2**: The v1 endpoint
  (`/wiki/rest/api/content/{pageId}/child/attachment`) works reliably
  for attachment uploads. The v2 endpoint
  (`/wiki/api/v2/pages/{pageId}/attachments`) was not tested.

**Alternatives considered**:
- Base64 inline images in markdown: Rejected — Confluence Cloud does
  not render base64 data URIs in markdown or storage format.
- Using Playwright to upload via Confluence's edit UI: Rejected — too
  fragile and complex for a documentation task.
- Hosting images externally (e.g., GCS bucket) and linking: Rejected —
  introduces infrastructure dependency for documentation assets.
- Markdown `![alt](filename.png)` via MCP `updateConfluencePage`:
  Rejected after testing — produces `<ri:url>` references instead of
  `<ri:attachment>`, and the alt-text parser corrupts filenames.

## Decision 3: Dev environment access for screenshots

**Decision**: Navigate to the dev frontend URL from the latest CI/CD
deploy. Use an approved account for login. For OTP, retrieve the code
from the browser console via `browser_console_messages` after
triggering the OTP flow.

**Rationale**: Constitution Dev UI Testing Prerequisites mandate using
the current dev frontend URL from the latest deploy workflow and
retrieving OTP from console output. The Playwright MCP has
`browser_console_messages` to read console output, making OTP retrieval
automatable.

**Alternatives considered**:
- Skipping login and capturing only public pages: Rejected — most
  screenshots require authenticated access (workbench, chat sessions).
- Using a pre-authenticated cookie: Rejected — session tokens expire;
  OTP login via Playwright is more reliable and repeatable.

## Decision 4: Content enrichment strategy

**Decision**: For each Confluence page, read the current content via
`getConfluencePage` (markdown format), rewrite with detailed content
meeting the Constitution XI detail standard, and update via
`updateConfluencePage`.

Content standards by section:

- **User Manual**: Each page covers purpose of the screen, how to reach
  it, every interactive element and its effect, numbered step-by-step
  workflows, and tips/warnings for common mistakes.

- **Non-Technical Onboarding**: Each page provides real-world examples,
  context for when concepts are encountered, and detailed narrative
  workflows. No code, CLI, or implementation details.

- **Technical Onboarding**: Each page includes exact commands, expected
  terminal output, troubleshooting steps for common failures, and
  cross-references to per-repo CLAUDE.md files.

- **Release Notes**: Each entry includes version, date, detailed
  change descriptions (not just bullet points), user impact, known
  issues, and Jira Epic links.

**Rationale**: The current pages have foundational content but do not
meet the self-service detail standard. Enrichment must be done
page-by-page with full rewrites rather than patches, because the
content structure needs to be reorganized around the detail criteria.

**Alternatives considered**:
- Appending additional detail to existing content: Rejected — the
  existing content structure doesn't match the required format;
  reorganization is needed.
- Generating content from code/repo analysis: Partially adopted —
  Technical Onboarding content will reference actual CLAUDE.md files
  and repo structures for accuracy.

## Decision 5: Screenshot inventory

Based on the `[SCREENSHOT: ...]` placeholders in the existing User
Manual pages (created by 012-confluence-documentation), the following
screenshots are needed:

| # | Page | UI State | Playwright steps |
|---|------|----------|-----------------|
| 1 | Getting Started | Login screen with email field | Navigate to dev URL → screenshot |
| 2 | Getting Started | OTP entry screen | Type email → submit → screenshot |
| 3 | Getting Started | Landing page after login | Complete OTP → screenshot |
| 4 | Chat Interface Guide | New chat session start | Navigate to chat → screenshot |
| 5 | Chat Interface Guide | Active messaging conversation | Start chat → type message → screenshot |
| 6 | Chat Interface Guide | Conversation history list | Navigate to history → screenshot |
| 7 | Workbench Guide | Admin overview/dashboard | Login as admin → navigate to workbench → screenshot |
| 8 | Workbench Guide | User management screen | Navigate to Users → screenshot |
| 9 | Workbench Guide | Group management screen | Navigate to Groups → screenshot |
| 10 | Workbench Guide | Session review screen | Navigate to Sessions → screenshot |
| 11 | Workbench Guide | Settings page | Navigate to Settings → screenshot |

Each screenshot requires:
1. `browser_navigate` to the dev URL
2. `browser_snapshot` to identify interactive elements
3. `browser_click` / `browser_fill_form` / `browser_type` to interact
4. `browser_run_code` with `await page.screenshot({ path: '<absolute-path>.png' })`
   to save to a known location

**Note**: `browser_take_screenshot` saves files relative to the
Playwright MCP server process's working directory, which may not be
the workspace root or an accessible path. Using `browser_run_code`
with an explicit absolute path is the reliable alternative discovered
during implementation.

## Decision 6: Jira task transition approach

**Decision**: Follow Constitution Principle X — transition each Jira
Task to Done immediately upon marking the corresponding `tasks.md` item
`[X]`. Transition each Jira Story when all its tasks are complete. No
batch transitions.

**Rationale**: Constitution v3.6.0 explicitly prohibits batch
transitions at the end of implementation. This feature will comply by
transitioning tasks individually during `speckit.implement` execution.

**Alternatives considered**: None — this is a constitutional mandate,
not a design choice.
