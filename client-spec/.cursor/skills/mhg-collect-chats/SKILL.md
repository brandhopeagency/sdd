---
name: mhg-collect-chats
description: Collect and filter MHG chat sessions from GCS bucket. Use when the user asks to "download chats", "collect chat sessions", "pull chats from bucket", "filter chat conversations", "get chats after date", or mentions GCS chat collection with date or message-count criteria.
---

# MHG Chat Session Collector

Collect chat sessions from the MHG GCS bucket into a local git-ignored folder, with filtering by date range and minimum user-message count.

## Bucket Structure

```
gs://mental-help-global-25-chat-conversations/
  incoming/
    {userId-uuid}/
      {sessionId-uuid}.json    <-- full session object
      {sessionId-uuid}.jsonl   <-- streaming event log
```

Each `.json` file contains:

```json
{
  "sessionId": "uuid",
  "userId": "uuid",
  "startedAt": "ISO-8601",
  "endedAt": "ISO-8601",
  "status": "ended",
  "messages": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

## Script

The single source of truth is `scripts/mhg-collect-chats.ps1` at the workspace root.

### Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `-Bucket` | `mental-help-global-25-chat-conversations` | GCS bucket name |
| `-Prefix` | `incoming` | Subfolder prefix inside the bucket |
| `-AfterDate` | `2026-01-15` | `YYYY-MM-DD` cutoff; sessions before this are removed |
| `-MinUserMessages` | `2` | Minimum messages with `role:"user"` to keep |
| `-OutputDir` | `chats` | Local output directory (git-ignored) |
| `-SkipDownload` | (switch) | Skip gsutil download, filter already-downloaded files |

### Usage

Run from the workspace root:

```powershell
# Full download + filter
powershell -ExecutionPolicy Bypass -File .\scripts\mhg-collect-chats.ps1 -AfterDate "2026-01-15" -MinUserMessages 2

# Re-filter without re-downloading
powershell -ExecutionPolicy Bypass -File .\scripts\mhg-collect-chats.ps1 -SkipDownload -MinUserMessages 3

# Custom bucket and output
powershell -ExecutionPolicy Bypass -File .\scripts\mhg-collect-chats.ps1 -Bucket "other-bucket" -OutputDir "my-chats"
```

## Workflow

1. Verify `chats/` is in `.gitignore` (add if missing).
2. Parse the user's request for date range and message-count criteria.
3. Build and execute the PowerShell command with appropriate parameters.
4. Report the summary output: total sessions found, removed by date, removed by message count, and remaining.
5. If the user asks about specific sessions, read the `.json` files from `chats/incoming/` to answer.

## Prerequisites

- `gsutil` authenticated with access to the bucket.
- PowerShell 5.1+ (Windows) or `pwsh` (cross-platform).
