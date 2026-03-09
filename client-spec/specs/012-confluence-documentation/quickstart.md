# Quickstart: Confluence Documentation Framework

**Feature**: 012-confluence-documentation
**Date**: 2026-02-22

## Prerequisites

- Access to the Mental Health Global Atlassian instance
  (https://mentalhelpglobal.atlassian.net)
- Confluence edit permissions in the `User Documentation` space
  (key: `UD`)
- Atlassian MCP (`plugin-atlassian-atlassian`) enabled in Cursor for
  programmatic page creation

## Confluence Space Details

| Property | Value |
|----------|-------|
| Space name | User Documentation |
| Space key | `UD` |
| Space ID | `8454147` |
| Cloud ID | `3aca5c6d-161e-42c2-8945-9c47aeb2966d` |
| Homepage ID | `8454317` |
| URL | https://mentalhelpglobal.atlassian.net/wiki/spaces/UD |

## Creating a Confluence Page via MCP

Use the `createConfluencePage` tool from the `plugin-atlassian-atlassian`
MCP server. Required parameters:

```text
cloudId:       "3aca5c6d-161e-42c2-8945-9c47aeb2966d"
spaceId:       "8454147"
title:         "Page Title"
parentId:      "<parent page ID>"
body:          "<Markdown content>"
contentFormat: "markdown"
```

## Page Hierarchy

All section root pages are children of the homepage (ID `8454317`).
Content pages are children of their respective section root.

```text
Homepage (8454317)
├── Release Notes (section root — child of homepage)
│   └── Release entries (children of Release Notes)
├── User Manual (section root — child of homepage)
│   └── Guide pages (children of User Manual)
├── Non-Technical Onboarding (section root — child of homepage)
│   └── Onboarding pages (children of Non-Technical Onboarding)
└── Technical Onboarding (section root — child of homepage)
    └── Technical pages (children of Technical Onboarding)
```

## Release Notes Entry Template

When creating a new Release Notes entry, use this page title and body
format:

**Title**: `Release <version> — <YYYY-MM-DD>`

**Body** (Markdown):

```markdown
# Release <version>

**Date**: <YYYY-MM-DD>
**Release tag**: `<git tag>`

## What's New

- <User-visible change 1>
- <User-visible change 2>
- <User-visible change 3>

## Known Issues

- <Known issue description> (or "None")

## Related Epics

- [<JIRA-KEY>: Epic title](https://mentalhelpglobal.atlassian.net/browse/<JIRA-KEY>)
```

## Adding Screenshots to User Manual

1. Navigate to the User Manual page in Confluence
2. Click the attachment icon (paperclip) to upload an image file
3. In the page editor, reference the attachment using Confluence's
   image macro or inline attachment syntax
4. Ensure the screenshot reflects the current production UI state

## Updating Documentation on Production Release

Per Constitution Principle XI, every production release triggers:

1. **Always**: Create a new Release Notes entry page
2. **If UI changed**: Update affected User Manual pages (screenshots
   and step-by-step text)
3. **If workflows changed**: Update Non-Technical Onboarding pages
4. **If tooling/repo changed**: Update Technical Onboarding pages

The speckit `/speckit.implement` command includes a documentation
update step (step 10) that prompts for these updates.

## Validation Checklist

After creating or updating documentation:

- [ ] All four section root pages exist under the homepage
- [ ] Release Notes entry includes version, date, changes, known
      issues, and Jira link
- [ ] User Manual pages are written in non-technical language
- [ ] User Manual screenshots match current production UI
- [ ] Non-Technical Onboarding has no code/CLI references
- [ ] Technical Onboarding links to per-repo CLAUDE.md/AGENTS.md files
- [ ] All pages are reachable within 3 clicks from the homepage
