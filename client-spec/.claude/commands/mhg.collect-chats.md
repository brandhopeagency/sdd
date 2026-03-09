---
description: Download and filter MHG chat sessions from GCS bucket
argument-hint: [-AfterDate YYYY-MM-DD] [-MinUserMessages N] [-SkipDownload]
allowed-tools: Bash(gsutil:*), Bash(powershell:*), Read, Write, Grep, Glob
---

## User Input

```text
$ARGUMENTS
```

Consider the user input before proceeding (if not empty).

## Overview

Collect chat sessions from the MHG GCS bucket, filter by date and minimum user-message count, and store locally in a git-ignored `chats/` folder.

## Parameters

Parse `$ARGUMENTS` for the following flags. Use defaults when not provided:

| Flag | Default | Description |
|------|---------|-------------|
| `-AfterDate` | 30 days before today | ISO date `YYYY-MM-DD`; sessions before this date are removed |
| `-MinUserMessages` | `2` | Minimum `role:"user"` messages to keep a session |
| `-SkipDownload` | not set | If present, skip the `gsutil` download and filter already-downloaded files |

## Execution

1. Ensure `chats/` is listed in `.gitignore` (add if missing).
2. Build the PowerShell command from parsed parameters:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\mhg-collect-chats.ps1 `
  -AfterDate "<value>" `
  -MinUserMessages <value> `
  [-SkipDownload]
```

3. Run the command and capture its output.
4. Report the summary table printed by the script (total, removed by date, removed by message count, remaining).

## Bucket Reference

- **Bucket**: `mental-help-global-25-chat-conversations`
- **Prefix**: `incoming/`
- **Structure**: `incoming/{userId-uuid}/{sessionId-uuid}.json` + `.jsonl`
- **JSON schema**: `{ sessionId, userId, startedAt, endedAt, status, messages: [{ role, content, timestamp, ... }] }`

## Script Location

`scripts/mhg-collect-chats.ps1` — the single source of truth for download and filtering logic. Do not duplicate or inline the script logic.
