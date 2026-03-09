---
description: Generate a single-page statistics dashboard for MHG chat sessions
argument-hint: [-InputDir path] [-OutputFile path]
allowed-tools: Bash(powershell:*), Read, Glob
---

## User Input

```text
$ARGUMENTS
```

Consider the user input before proceeding (if not empty).

## Overview

Compute aggregate metrics across all downloaded MHG chat sessions and produce a self-contained HTML dashboard with summary cards, data tables, and inline SVG charts.

## Parameters

Parse `$ARGUMENTS` for the following flags. Use defaults when not provided:

| Flag | Default | Description |
|------|---------|-------------|
| `-InputDir` | `chats/incoming` | Source folder with `{userId}/{sessionId}.json` files |
| `-OutputFile` | `chats/stats.html` | Output path for the HTML dashboard |

## Execution

1. Build and run the PowerShell command:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\mhg-chat-stats.ps1 `
  -InputDir "<value>" -OutputFile "<value>"
```

2. Report the console summary: total sessions, unique users, avg duration, avg messages, parse errors.

## Dashboard Metrics

- **Summary cards**: Total sessions, Unique users, Avg/Med/Min/Max duration, Avg/Med/Min/Max messages, Avg user/assistant message length, Response time (avg, p50, p95)
- **Charts (inline SVG)**: Session duration histogram, Messages per session histogram, Sessions per user bar chart
- **Tables**: User breakdown (user ID, sessions, total messages), Language breakdown, Status breakdown

## Script Location

`scripts/mhg-chat-stats.ps1` -- single source of truth for statistics logic.
