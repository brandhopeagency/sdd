---
name: mhg-format-chats
description: Render MHG chat sessions as human-readable HTML files. Use when the user asks to "format chats", "render sessions to HTML", "create chat viewer", "display session details", "view chat transcripts", or mentions converting JSON chat sessions to a readable format.
---

# MHG Chat Session Formatter

Convert raw JSON chat sessions from the GCS bucket into self-contained HTML files for human review. One HTML file per session.

## What Each HTML File Contains

- **Header card**: Session ID, User ID, Status, Start/End times, computed Duration, Language, Environment, Dialogflow Session ID, Message count
- **System Prompts**: Collapsible blocks showing agent memory entries (facts, preferences, state_timeline) with kind, updatedAt, role, and content
- **Message Timeline**: Chronological messages with role badges (user = blue, assistant = green), whitespace-preserved content, and assistant response time in ms
- **RAG Details**: Collapsible panels on assistant messages showing:
  - Match type and confidence
  - User query and rewritten query
  - Search steps (name, status code, timing)
  - Search results (document path, URL, text snippet)
  - Execution result (response_type, response_reason, latency, language, grounding status)

## Script

The single source of truth is `scripts/mhg-format-chats.ps1` at the workspace root.

### Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `-InputDir` | `chats/incoming` | Source folder with `{userId}/{sessionId}.json` files |
| `-OutputDir` | `chats/formatted` | Destination folder for HTML files |

### Usage

Run from the workspace root:

```powershell
# Default: format all sessions in chats/incoming
powershell -ExecutionPolicy Bypass -File .\scripts\mhg-format-chats.ps1

# Custom paths
powershell -ExecutionPolicy Bypass -File .\scripts\mhg-format-chats.ps1 -InputDir "my-chats" -OutputDir "my-output"
```

## Workflow

1. Ensure chat sessions have been downloaded (use the `mhg-collect-chats` skill first if needed).
2. Run the formatter script with desired parameters.
3. Report the summary: files formatted, errors, output path.
4. HTML files can be opened directly in a browser.

## Prerequisites

- Chat sessions already downloaded into the input directory (`.json` files).
- PowerShell 5.1+ (Windows) or `pwsh`.
