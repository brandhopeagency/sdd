---
name: mhg-chat-stats
description: Generate statistics dashboard for MHG chat sessions. Use when the user asks for "chat statistics", "session analytics", "chat metrics", "session summary", "analyze chats", "chat report", or mentions computing aggregate metrics across downloaded chat sessions.
---

# MHG Chat Statistics Dashboard

Compute aggregate metrics across all downloaded MHG chat sessions and produce a single self-contained HTML dashboard with summary cards, data tables, and inline SVG charts.

## Available Metrics

- **Session counts**: total sessions, sessions per user
- **Unique users**: count of distinct user IDs
- **Duration**: min, max, avg, median session duration
- **Message counts**: min, max, avg, median messages per session
- **Message length**: avg user message length, avg assistant message length (chars)
- **Response times**: avg, p50, p95 assistant response time (ms)
- **Language breakdown**: sessions per language code
- **Status breakdown**: sessions by status (ended, expired, etc.)

## Dashboard Layout

- **Summary cards row**: Total Sessions, Unique Users, Avg Duration, Avg Messages, Avg Msg Lengths, Response Time
- **SVG charts**: Session duration histogram, Messages per session histogram, Sessions per user bar chart
- **Tables**: User breakdown, Language breakdown, Status breakdown

All charts are inline SVG with zero external dependencies.

## Script

The single source of truth is `scripts/mhg-chat-stats.ps1` at the workspace root.

### Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `-InputDir` | `chats/incoming` | Source folder with `{userId}/{sessionId}.json` files |
| `-OutputFile` | `chats/stats.html` | Output path for the HTML dashboard |

### Usage

Run from the workspace root:

```powershell
# Default: analyze chats/incoming, write to chats/stats.html
powershell -ExecutionPolicy Bypass -File .\scripts\mhg-chat-stats.ps1

# Custom paths
powershell -ExecutionPolicy Bypass -File .\scripts\mhg-chat-stats.ps1 -InputDir "my-chats" -OutputFile "reports/stats.html"
```

## Workflow

1. Ensure chat sessions have been downloaded (use the `mhg-collect-chats` skill first if needed).
2. Run the stats script with desired parameters.
3. Report the console summary: total sessions, unique users, avg duration, avg messages.
4. Open the generated HTML file in a browser.

## Prerequisites

- Chat sessions already downloaded into the input directory (`.json` files).
- PowerShell 5.1+ (Windows) or `pwsh`.
