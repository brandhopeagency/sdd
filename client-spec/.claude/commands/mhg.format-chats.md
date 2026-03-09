---
description: Render downloaded MHG chat sessions as human-readable HTML files
argument-hint: [-InputDir path] [-OutputDir path]
allowed-tools: Bash(powershell:*), Read, Glob
---

## User Input

```text
$ARGUMENTS
```

Consider the user input before proceeding (if not empty).

## Overview

Convert raw JSON chat sessions into self-contained HTML files for human review. Each file includes session metadata, system prompts, a message timeline with chat-bubble styling, and collapsible RAG/DataStore diagnostic panels.

## Parameters

Parse `$ARGUMENTS` for the following flags. Use defaults when not provided:

| Flag | Default | Description |
|------|---------|-------------|
| `-InputDir` | `chats/incoming` | Source folder with `{userId}/{sessionId}.json` files |
| `-OutputDir` | `chats/formatted` | Destination folder for HTML files |

## Execution

1. Build and run the PowerShell command:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\mhg-format-chats.ps1 `
  -InputDir "<value>" -OutputDir "<value>"
```

2. Report the summary: files formatted, errors, output path.

## HTML Content Per Session

- **Header card**: Session ID, User ID, Status, Start/End/Duration, Language, Environment, Dialogflow Session ID, Message count
- **System Prompts**: Collapsible blocks for agent memory (facts, preferences, state_timeline)
- **Message Timeline**: Timestamped messages with role badges (user=blue, assistant=green), whitespace-preserved content, response time
- **RAG Details**: Collapsible panels on assistant messages showing match type/confidence, user query, rewritten query, search steps, search results (document, snippet, URL), execution result (response type/reason, latency, language)

## Script Location

`scripts/mhg-format-chats.ps1` -- single source of truth for formatting logic.
