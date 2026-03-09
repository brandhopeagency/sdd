<#
.SYNOPSIS
    Render downloaded MHG chat sessions as human-readable HTML files.

.DESCRIPTION
    Reads each .json session file from InputDir, extracts session metadata,
    system prompts, messages, match info, and RAG/DataStore diagnostic details,
    then writes one self-contained HTML file per session to OutputDir.

    Uses .NET JavaScriptSerializer to handle deeply-nested JSON that
    ConvertFrom-Json (PowerShell 5.1) cannot parse.

.PARAMETER InputDir
    Folder containing userId/sessionId.json files. Default: chats/incoming

.PARAMETER OutputDir
    Destination folder for generated HTML files. Default: chats/formatted

.EXAMPLE
    .\scripts\mhg-format-chats.ps1
    .\scripts\mhg-format-chats.ps1 -InputDir "chats/incoming" -OutputDir "chats/formatted"
#>

param(
    [string]$InputDir  = "chats/incoming",
    [string]$OutputDir = "chats/formatted"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Web.Extensions
Add-Type -AssemblyName System.Web

function Read-ChatJson {
    param([string]$Path)
    $raw = [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8)
    $ser = New-Object System.Web.Script.Serialization.JavaScriptSerializer
    $ser.MaxJsonLength = [int]::MaxValue
    $ser.RecursionLimit = 100
    return $ser.DeserializeObject($raw)
}

function HtmlEncode {
    param([string]$Text)
    if (-not $Text) { return "" }
    return [System.Web.HttpUtility]::HtmlEncode($Text)
}

function FormatDuration {
    param([timespan]$Span)
    if ($Span.TotalHours -ge 1) {
        return "{0}h {1}m {2}s" -f [int]$Span.TotalHours, $Span.Minutes, $Span.Seconds
    }
    elseif ($Span.TotalMinutes -ge 1) {
        return "{0}m {1}s" -f [int]$Span.TotalMinutes, $Span.Seconds
    }
    else {
        return "{0}s" -f [int]$Span.TotalSeconds
    }
}

function SafeGet {
    param($Obj, [string[]]$Keys)
    $cur = $Obj
    foreach ($k in $Keys) {
        if ($null -eq $cur) { return $null }
        if ($cur -is [System.Collections.IDictionary] -and $cur.ContainsKey($k)) {
            $cur = $cur[$k]
        }
        else { return $null }
    }
    return $cur
}

function Get-CssStyle {
    return @'
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f5f5f5; color: #1a1a1a; line-height: 1.5; padding: 20px; max-width: 960px; margin: 0 auto; }
h1 { font-size: 1.3rem; margin-bottom: 12px; }
h2 { font-size: 1.1rem; margin: 18px 0 8px; }
.header-card { background: #fff; border-radius: 10px; padding: 18px 22px; margin-bottom: 18px; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
.header-card table { width: 100%; border-collapse: collapse; font-size: .88rem; }
.header-card td { padding: 3px 8px; vertical-align: top; }
.header-card td:first-child { font-weight: 600; white-space: nowrap; width: 180px; color: #555; }
.system-prompts { background: #fff; border-radius: 10px; padding: 16px 20px; margin-bottom: 18px; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
.system-prompts details { margin-bottom: 8px; }
.system-prompts summary { cursor: pointer; font-weight: 600; font-size: .88rem; color: #6a4c93; }
.system-prompts pre { background: #faf8ff; border: 1px solid #e8e0f0; border-radius: 6px; padding: 10px; margin-top: 6px; font-size: .82rem; white-space: pre-wrap; word-break: break-word; max-height: 300px; overflow-y: auto; }
.timeline { display: flex; flex-direction: column; gap: 10px; }
.msg { background: #fff; border-radius: 10px; padding: 14px 18px; box-shadow: 0 1px 3px rgba(0,0,0,.06); }
.msg.user { border-left: 4px solid #3b82f6; }
.msg.assistant { border-left: 4px solid #22c55e; }
.msg-header { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; font-size: .82rem; color: #666; }
.badge { display: inline-block; padding: 1px 8px; border-radius: 4px; font-weight: 600; font-size: .78rem; text-transform: uppercase; }
.badge.user { background: #dbeafe; color: #1e40af; }
.badge.assistant { background: #dcfce7; color: #166534; }
.msg-content { white-space: pre-wrap; word-break: break-word; font-size: .92rem; }
.response-time { font-size: .78rem; color: #888; margin-top: 6px; }
details.rag { margin-top: 8px; }
details.rag summary { cursor: pointer; font-size: .82rem; font-weight: 600; color: #b45309; }
.rag-panel { background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 12px; margin-top: 6px; font-size: .82rem; }
.rag-panel table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
.rag-panel td { padding: 2px 6px; vertical-align: top; }
.rag-panel td:first-child { font-weight: 600; white-space: nowrap; color: #92400e; width: 200px; }
.search-result { background: #fff; border: 1px solid #e5e7eb; border-radius: 4px; padding: 8px; margin-bottom: 6px; }
.search-result .doc { font-weight: 600; font-size: .8rem; color: #1e3a5f; }
.search-result .snippet { font-size: .8rem; color: #444; margin-top: 2px; max-height: 120px; overflow-y: auto; }
.search-step { padding: 4px 0; border-bottom: 1px solid #f3f4f6; font-size: .8rem; }
.search-step:last-child { border-bottom: none; }
.step-ok { color: #16a34a; }
.step-fail { color: #dc2626; }
'@
}

function Build-SessionHtml {
    param($Session)

    $sessionId  = SafeGet $Session @("sessionId")
    $userId     = SafeGet $Session @("userId")
    $status     = SafeGet $Session @("status")
    $startedAt  = SafeGet $Session @("startedAt")
    $endedAt    = SafeGet $Session @("endedAt")
    $metadata   = SafeGet $Session @("metadata")
    $messages   = SafeGet $Session @("messages")

    $langCode    = if ($metadata) { SafeGet $metadata @("languageCode") } else { "" }
    $env         = if ($metadata) { SafeGet $metadata @("environment") } else { "" }
    $dfSessionId = if ($metadata) { SafeGet $metadata @("dialogflowSessionId") } else { "" }
    $msgCount    = if ($metadata) { SafeGet $metadata @("messageCount") } else { "" }

    $durationStr = ""
    if ($startedAt -and $endedAt) {
        try {
            $s = [datetime]::Parse($startedAt).ToUniversalTime()
            $e = [datetime]::Parse($endedAt).ToUniversalTime()
            $durationStr = FormatDuration ($e - $s)
        } catch {}
    }

    $sb = New-Object System.Text.StringBuilder
    [void]$sb.AppendLine("<!DOCTYPE html><html lang='en'><head><meta charset='utf-8'/>")
    [void]$sb.AppendLine("<meta name='viewport' content='width=device-width,initial-scale=1'/>")
    [void]$sb.AppendLine("<title>Session $(HtmlEncode $sessionId)</title>")
    [void]$sb.AppendLine("<style>$(Get-CssStyle)</style></head><body>")

    # --- Header Card ---
    [void]$sb.AppendLine("<div class='header-card'><h1>Chat Session</h1><table>")
    [void]$sb.AppendLine("<tr><td>Session ID</td><td>$(HtmlEncode $sessionId)</td></tr>")
    [void]$sb.AppendLine("<tr><td>User ID</td><td>$(HtmlEncode $userId)</td></tr>")
    [void]$sb.AppendLine("<tr><td>Status</td><td>$(HtmlEncode $status)</td></tr>")
    [void]$sb.AppendLine("<tr><td>Started At</td><td>$(HtmlEncode $startedAt)</td></tr>")
    [void]$sb.AppendLine("<tr><td>Ended At</td><td>$(HtmlEncode $endedAt)</td></tr>")
    if ($durationStr) {
        [void]$sb.AppendLine("<tr><td>Duration</td><td>$durationStr</td></tr>")
    }
    if ($langCode)    { [void]$sb.AppendLine("<tr><td>Language</td><td>$(HtmlEncode $langCode)</td></tr>") }
    if ($env)         { [void]$sb.AppendLine("<tr><td>Environment</td><td>$(HtmlEncode $env)</td></tr>") }
    if ($dfSessionId) { [void]$sb.AppendLine("<tr><td>Dialogflow Session</td><td style='word-break:break-all'>$(HtmlEncode $dfSessionId)</td></tr>") }
    if ($msgCount)    { [void]$sb.AppendLine("<tr><td>Message Count</td><td>$msgCount</td></tr>") }
    [void]$sb.AppendLine("</table></div>")

    # --- System Prompts ---
    $firstAssistant = $null
    if ($messages) {
        foreach ($m in $messages) {
            if ((SafeGet $m @("role")) -eq "assistant") { $firstAssistant = $m; break }
        }
    }
    $sysPrompts = if ($firstAssistant) { SafeGet $firstAssistant @("systemPrompts", "agentMemorySystemMessages") } else { $null }
    if ($sysPrompts -and $sysPrompts.Count -gt 0) {
        [void]$sb.AppendLine("<div class='system-prompts'><h2>System Prompts (Agent Memory)</h2>")
        foreach ($sp in $sysPrompts) {
            $kind      = SafeGet $sp @("meta", "kind")
            $updatedAt = SafeGet $sp @("meta", "updatedAt")
            $spRole    = SafeGet $sp @("role")
            $spContent = SafeGet $sp @("content")
            $label = if ($kind) { HtmlEncode $kind } else { "system" }
            [void]$sb.AppendLine("<details><summary>$label")
            if ($updatedAt) { [void]$sb.Append(" <span style='font-weight:normal;color:#888'>($updatedAt)</span>") }
            [void]$sb.AppendLine("</summary>")
            if ($spRole) { [void]$sb.AppendLine("<div style='font-size:.8rem;color:#666;margin-top:4px'>Role: $(HtmlEncode $spRole)</div>") }
            [void]$sb.AppendLine("<pre>$(HtmlEncode $spContent)</pre></details>")
        }
        [void]$sb.AppendLine("</div>")
    }

    # --- Message Timeline ---
    [void]$sb.AppendLine("<h2>Messages</h2><div class='timeline'>")
    if ($messages) {
        foreach ($msg in $messages) {
            $role      = SafeGet $msg @("role")
            $content   = SafeGet $msg @("content")
            $timestamp = SafeGet $msg @("timestamp")
            $respTime  = SafeGet $msg @("responseTimeMs")

            $roleClass = if ($role -eq "user") { "user" } else { "assistant" }

            [void]$sb.AppendLine("<div class='msg $roleClass'>")
            [void]$sb.AppendLine("<div class='msg-header'>")
            [void]$sb.AppendLine("<span class='badge $roleClass'>$(HtmlEncode $role)</span>")
            if ($timestamp) { [void]$sb.Append("<span>$(HtmlEncode $timestamp)</span>") }
            [void]$sb.AppendLine("</div>")
            [void]$sb.AppendLine("<div class='msg-content'>$(HtmlEncode $content)</div>")

            if ($role -eq "assistant" -and $respTime) {
                [void]$sb.AppendLine("<div class='response-time'>Response time: ${respTime}ms</div>")
            }

            # RAG Details for assistant messages
            if ($role -eq "assistant") {
                $dsSeq = SafeGet $msg @("diagnosticInfo", "fields", "DataStore Execution Sequence")
                $matchObj = SafeGet $msg @("match")
                $hasRag = $false

                $structFields = $null
                if ($dsSeq) {
                    $structFields = SafeGet $dsSeq @("structValue", "fields")
                    if ($structFields) {
                        foreach ($key in $structFields.Keys) {
                            $inner = $structFields[$key]
                            if ($inner -and (SafeGet $inner @("fields"))) {
                                $hasRag = $true
                                break
                            }
                        }
                    }
                }

                if ($hasRag -or ($matchObj -and (SafeGet $matchObj @("type")))) {
                    [void]$sb.AppendLine("<details class='rag'><summary>RAG / Match Details</summary><div class='rag-panel'>")

                    # Match info
                    if ($matchObj) {
                        $mType = SafeGet $matchObj @("type")
                        $mConf = SafeGet $matchObj @("confidence")
                        if ($mType) {
                            [void]$sb.AppendLine("<table><tr><td>Match Type</td><td>$(HtmlEncode $mType)</td></tr>")
                            [void]$sb.AppendLine("<tr><td>Confidence</td><td>$mConf</td></tr></table>")
                        }
                    }

                    # DataStore details
                    if ($structFields) {
                        foreach ($key in $structFields.Keys) {
                            $inner = $structFields[$key]
                            $innerFields = SafeGet $inner @("fields")
                            if (-not $innerFields) { continue }

                            $addInfo = SafeGet $innerFields @("additionalInfo")
                            $execResult = SafeGet $innerFields @("executionResult")
                            $steps = SafeGet $innerFields @("steps")

                            # Additional info
                            if ($addInfo) {
                                $uq = SafeGet $addInfo @("user_query")
                                $rq = SafeGet $addInfo @("rewritten_query")
                                $used = SafeGet $addInfo @("search_results_used_in_main_prompt")
                                [void]$sb.AppendLine("<table>")
                                if ($uq)   { [void]$sb.AppendLine("<tr><td>User Query</td><td>$(HtmlEncode $uq)</td></tr>") }
                                if ($rq)   { [void]$sb.AppendLine("<tr><td>Rewritten Query</td><td>$(HtmlEncode $rq)</td></tr>") }
                                if ($used) { [void]$sb.AppendLine("<tr><td>Results Used</td><td>$(HtmlEncode $used)</td></tr>") }
                                [void]$sb.AppendLine("</table>")
                            }

                            # Execution result
                            if ($execResult) {
                                $respType   = SafeGet $execResult @("response_type")
                                $respReason = SafeGet $execResult @("response_reason")
                                $lat        = SafeGet $execResult @("latency")
                                $lang       = SafeGet $execResult @("language")
                                [void]$sb.AppendLine("<table>")
                                if ($respType)   { [void]$sb.AppendLine("<tr><td>Response Type</td><td>$(HtmlEncode ([string]$respType))</td></tr>") }
                                if ($respReason) { [void]$sb.AppendLine("<tr><td>Response Reason</td><td>$(HtmlEncode ([string]$respReason))</td></tr>") }
                                if ($lat)        { [void]$sb.AppendLine("<tr><td>Latency</td><td>${lat}ms</td></tr>") }
                                if ($lang)       { [void]$sb.AppendLine("<tr><td>Language</td><td>$(HtmlEncode ([string]$lang))</td></tr>") }
                                [void]$sb.AppendLine("</table>")
                            }

                            # Search steps
                            if ($steps -and $steps.Count -gt 0) {
                                [void]$sb.AppendLine("<h3 style='font-size:.85rem;margin:8px 0 4px'>Search Steps</h3>")
                                foreach ($step in $steps) {
                                    $sName   = SafeGet $step @("name")
                                    $sStatus = SafeGet (SafeGet $step @("status")) @("code")
                                    $statusClass = if ($sStatus -eq "OK") { "step-ok" } else { "step-fail" }
                                    [void]$sb.AppendLine("<div class='search-step'>")
                                    [void]$sb.AppendLine("<strong>$(HtmlEncode $sName)</strong> <span class='$statusClass'>[$sStatus]</span>")

                                    # Search results within steps
                                    $responses = SafeGet $step @("responses")
                                    if ($responses -and $responses.Count -gt 0) {
                                        foreach ($resp in $responses) {
                                            $doc     = SafeGet $resp @("document")
                                            $text    = SafeGet $resp @("text")
                                            $url     = SafeGet $resp @("url")
                                            [void]$sb.AppendLine("<div class='search-result'>")
                                            if ($doc)  { [void]$sb.AppendLine("<div class='doc'>$(HtmlEncode $doc)</div>") }
                                            if ($url)  { [void]$sb.AppendLine("<div style='font-size:.75rem;color:#2563eb;word-break:break-all'>$(HtmlEncode $url)</div>") }
                                            if ($text) { [void]$sb.AppendLine("<div class='snippet'>$(HtmlEncode $text)</div>") }
                                            [void]$sb.AppendLine("</div>")
                                        }
                                    }
                                    [void]$sb.AppendLine("</div>")
                                }
                            }
                        }
                    }
                    [void]$sb.AppendLine("</div></details>")
                }
            }
            [void]$sb.AppendLine("</div>")
        }
    }
    [void]$sb.AppendLine("</div></body></html>")
    return $sb.ToString()
}

# --- Main ---
Write-Host "=== MHG Chat Formatter ===" -ForegroundColor Cyan
Write-Host "Input  : $InputDir"
Write-Host "Output : $OutputDir"
Write-Host ""

if (-not (Test-Path $InputDir)) {
    Write-Error "Input directory not found: $InputDir"
    exit 1
}

if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

$jsonFiles = @(Get-ChildItem -Path $InputDir -Filter "*.json" -Recurse -File)
Write-Host "Found $($jsonFiles.Count) session files." -ForegroundColor Green

$successCount = 0
$errorCount   = 0

foreach ($file in $jsonFiles) {
    try {
        $session = Read-ChatJson -Path $file.FullName
        $sid = SafeGet $session @("sessionId")
        if (-not $sid) { $sid = [System.IO.Path]::GetFileNameWithoutExtension($file.Name) }

        $html = Build-SessionHtml -Session $session
        $outPath = Join-Path $OutputDir "$sid.html"
        [System.IO.File]::WriteAllText($outPath, $html, [System.Text.Encoding]::UTF8)
        $successCount++
    }
    catch {
        Write-Warning "Failed to format $($file.FullName): $_"
        $errorCount++
    }
}

Write-Host ""
Write-Host "=== Summary ===" -ForegroundColor Cyan
Write-Host ("  Formatted : {0}" -f $successCount) -ForegroundColor Green
Write-Host ("  Errors    : {0}" -f $errorCount)
Write-Host ("  Output in : {0}" -f (Resolve-Path $OutputDir))
Write-Host ""
