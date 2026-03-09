# Quickstart: Automated Documentation Screenshots & Content Enhancement

**Feature**: 013-automate-doc-screenshots
**Date**: 2026-02-22

## Prerequisites

| Prerequisite | Details |
|-------------|---------|
| Playwright MCP | `plugin-playwright-playwright` enabled in Cursor |
| Atlassian MCP | `plugin-atlassian-atlassian` enabled in Cursor |
| Atlassian API token | Required for REST API attachment uploads (Basic Auth) |
| Dev environment | Deployed and accessible via latest CI/CD deploy URL |
| Dev account | Approved account with client/therapist/admin permissions |
| Confluence space | `User Documentation` (spaceId `8454147`, key `UD`) |
| Confluence site | `mentalhelpglobal.atlassian.net` |
| Jira project | `MTB` (cloudId `3aca5c6d-161e-42c2-8945-9c47aeb2966d`) |
| Shell tool | `curl.exe` available for multipart file uploads |

## MCP Parameters (shared across all tasks)

| Parameter | Value |
|-----------|-------|
| `cloudId` | `3aca5c6d-161e-42c2-8945-9c47aeb2966d` |
| `spaceId` | `8454147` |
| Confluence `contentFormat` | `markdown` |

## Confluence Page IDs

### Section roots

| Section | Page ID | Parent |
|---------|---------|--------|
| Homepage | `8454317` | — |
| Release Notes | `8781825` | `8454317` |
| User Manual | `8749070` | `8454317` |
| Non-Technical Onboarding | `8814593` | `8454317` |
| Technical Onboarding | `8847361` | `8454317` |

### Content pages — User Manual

| Page | ID | Parent |
|------|-----|--------|
| Getting Started | `8945665` | `8749070` |
| Chat Interface Guide | `8847380` | `8749070` |
| Workbench Guide | `8978433` | `8749070` |
| FAQ | `8814612` | `8749070` |

### Content pages — Non-Technical Onboarding

| Page | ID | Parent |
|------|-----|--------|
| Product Overview | `8749089` | `8814593` |
| Key Terminology | `8847399` | `8814593` |
| User Workflows | `9011367` | `8814593` |
| Navigating the System | `9043969` | `8814593` |

### Content pages — Technical Onboarding

| Page | ID | Parent |
|------|-----|--------|
| Architecture Overview | `8781844` | `8847361` |
| Repository Structure | `8781863` | `8847361` |
| Local Development Setup | `8683524` | `8847361` |
| CI/CD Pipelines | `8978454` | `8847361` |
| Coding Conventions | `8749108` | `8847361` |
| Debugging Guide | `8978476` | `8847361` |

### Content pages — Release Notes

| Page | ID | Parent |
|------|-----|--------|
| Release v1.0.0 | `8880129` | `8781825` |

## Workflow 1: Capture a screenshot with Playwright MCP

### Step-by-step

1. **Navigate** to the dev environment:

   ```
   Tool: browser_navigate
   Arguments: { "url": "<dev frontend URL>" }
   ```

2. **Inspect the page** to find interactive elements:

   ```
   Tool: browser_snapshot
   Arguments: {}
   ```

3. **Interact** to reach the desired UI state (click, type, fill):

   ```
   Tool: browser_click
   Arguments: { "element": "<description>", "ref": "<ref from snapshot>" }

   Tool: browser_type
   Arguments: { "text": "<text>", "element": "<description>", "ref": "<ref>" }
   ```

4. **Capture the screenshot** using `browser_run_code` with an explicit
   absolute path (NOT `browser_take_screenshot` — see warning below):

   ```
   Tool: browser_run_code
   Arguments: {
     "code": "await page.screenshot({ path: 'D:\\\\src\\\\MHG\\\\client-spec\\\\screenshots\\\\<name>.png' })"
   }
   ```

5. **Repeat** steps 2–4 for each required UI state.

### OTP login flow

1. Navigate to the dev login page.
2. Fill the email field and submit.
3. Read OTP from console:

   ```
   Tool: browser_console_messages
   Arguments: {}
   ```

4. Fill the OTP field and submit.
5. Wait for the landing page to load before capturing.

### Warning: `browser_take_screenshot` file location

`browser_take_screenshot` saves files relative to the Playwright MCP
server process's working directory, which may be a temporary or
sandboxed location — NOT the workspace root. Files saved this way may
be inaccessible for subsequent upload steps. Always use
`browser_run_code` with `page.screenshot({ path: '<absolute>' })` to
save to a known, accessible directory.

## Workflow 2: Upload screenshots and embed in Confluence pages

### Step-by-step

1. **Upload** each screenshot as a page attachment via `curl.exe`:

   ```powershell
   curl.exe -s -o - -w "`nHTTP_STATUS:%{http_code}" `
     -X POST "https://mentalhelpglobal.atlassian.net/wiki/rest/api/content/<pageId>/child/attachment" `
     -u "<email>:<api-token>" `
     -H "X-Atlassian-Token: nocheck" `
     -F "file=@D:\src\MHG\client-spec\screenshots\<screenshot>.png"
   ```

   Expect `HTTP_STATUS:200` for success.

   **Note**: Do NOT use PowerShell `Invoke-RestMethod` for multipart
   uploads — it returns HTTP 500 with the Confluence attachment endpoint.
   Use `curl.exe` instead.

2. **Retrieve** the page content in storage format:

   ```powershell
   $response = curl.exe -s `
     "https://mentalhelpglobal.atlassian.net/wiki/rest/api/content/<pageId>?expand=body.storage,version" `
     -u "<email>:<api-token>"
   $page = $response | ConvertFrom-Json
   $body = $page.body.storage.value
   $currentVersion = $page.version.number
   ```

3. **Fix image references** in the storage format — replace `<ri:url>`
   with `<ri:attachment>`:

   ```powershell
   # Replace incorrect ri:url references with ri:attachment
   $body = $body -replace `
     '<ri:url ri:value="<screenshot>.png" />', `
     '<ri:attachment ri:filename="<screenshot>.png" />'

   # Also fix any corrupted ac:src attributes by removing them
   # (the ac:src attribute is not needed when ri:attachment is used)
   ```

   **Why**: The Atlassian MCP's markdown converter turns
   `![alt](file.png)` into `<ri:url ri:value="file.png" />` which
   references an external URL. Page attachments require
   `<ri:attachment ri:filename="file.png" />`.

4. **PUT** the corrected content back:

   ```powershell
   $payload = @{
     version = @{ number = ($currentVersion + 1); message = "Fixed image attachment references" }
     title = "<Page Title>"
     type = "page"
     body = @{
       storage = @{
         value = $body
         representation = "storage"
       }
     }
   } | ConvertTo-Json -Depth 5 -Compress

   # Save payload to file (avoids shell escaping issues with large JSON)
   $payload | Out-File -Encoding utf8 "update-<pageId>.json"

   curl.exe -s -w "`nHTTP_STATUS:%{http_code}" `
     -X PUT "https://mentalhelpglobal.atlassian.net/wiki/rest/api/content/<pageId>" `
     -u "<email>:<api-token>" `
     -H "Content-Type: application/json" `
     -d "@update-<pageId>.json"
   ```

   Expect `HTTP_STATUS:200` for success.

### Correct Confluence storage format for embedded attachments

```xml
<ac:image ac:align="center" ac:layout="center">
  <ri:attachment ri:filename="screenshot-name.png" />
</ac:image>
```

### Incorrect format (produced by MCP markdown converter)

```xml
<ac:image ac:align="center" ac:layout="center" ac:src="screenshot-name.png">
  <ri:url ri:value="screenshot-name.png" />
</ac:image>
```

The `<ri:url>` element treats the value as an external URL. Since
`screenshot-name.png` is not a valid URL, the image appears broken.

## Workflow 3: Update a Confluence page with enriched content

### Step-by-step

1. **Read** the current page content:

   ```
   Tool: getConfluencePage
   Arguments: {
     "cloudId": "3aca5c6d-161e-42c2-8945-9c47aeb2966d",
     "pageId": "<page ID>",
     "contentFormat": "markdown"
   }
   ```

2. **Rewrite** the content with enriched detail, following the content
   standard for the page's section (see Content Standards below).

3. **Update** the page:

   ```
   Tool: updateConfluencePage
   Arguments: {
     "cloudId": "3aca5c6d-161e-42c2-8945-9c47aeb2966d",
     "pageId": "<page ID>",
     "body": "<enriched markdown content>",
     "contentFormat": "markdown",
     "versionMessage": "013: Enriched content to detail standard"
   }
   ```

**Important**: If the page contains embedded screenshots, do NOT use
markdown `![alt](file.png)` syntax. Instead, follow Workflow 2 to
upload attachments and embed them using storage format. The MCP's
markdown converter produces incorrect `<ri:url>` references for
local filenames.

## Content Standards

### User Manual pages

Each page MUST include:

1. **Purpose**: What this screen/feature does and why a user would use it
2. **How to reach it**: Navigation path from login to this screen
3. **Interactive elements**: Every button, field, link, and control —
   what it does and when to use it
4. **Step-by-step workflows**: Numbered instructions for the primary
   task(s) on this screen
5. **Tips and warnings**: Common mistakes, things to watch out for,
   and helpful shortcuts

### Non-Technical Onboarding pages

Each page MUST include:

1. **Context**: Why this topic matters for understanding the product
2. **Detailed explanations**: Written for someone with no technical
   background
3. **Real examples**: Concrete scenarios showing how concepts apply
4. **No code/CLI**: Zero technical commands or implementation references

### Technical Onboarding pages

Each page MUST include:

1. **Concrete commands**: Exact shell commands to run
2. **Expected output**: What the terminal should show
3. **Troubleshooting**: What to do if the output differs
4. **Cross-references**: Links to per-repo CLAUDE.md files where
   applicable

### Release Notes entries

Each entry MUST include:

1. **Version and date**: Release tag and deployment date
2. **What's New**: Detailed description of each change, explaining
   user impact (not just feature names)
3. **Known Issues**: Any limitations or bugs in this release
4. **Related Epics**: Links to Jira Epics for traceability

## Jira Transition Workflow

For every task completed during implementation:

1. Mark `[X]` in `tasks.md`
2. Post a completion comment:

   ```
   Tool: addCommentToJiraIssue
   Arguments: {
     "cloudId": "3aca5c6d-161e-42c2-8945-9c47aeb2966d",
     "issueKey": "<task Jira key>",
     "body": "Completed: <brief description of what was done>"
   }
   ```

3. Get available transitions:

   ```
   Tool: getTransitionsForJiraIssue
   Arguments: {
     "cloudId": "3aca5c6d-161e-42c2-8945-9c47aeb2966d",
     "issueKey": "<task Jira key>"
   }
   ```

4. Transition to Done:

   ```
   Tool: transitionJiraIssue
   Arguments: {
     "cloudId": "3aca5c6d-161e-42c2-8945-9c47aeb2966d",
     "issueKey": "<task Jira key>",
     "transitionId": "<Done transition ID>"
   }
   ```

Do this **immediately** for each task — do NOT batch at the end.
