<#
.SYNOPSIS
    Generate a single-page statistics dashboard for MHG chat sessions.

.DESCRIPTION
    Reads all .json session files from InputDir, computes aggregate metrics
    (session counts, durations, message lengths, response times, per-user
    breakdown, language/status distribution), and writes a self-contained
    HTML file with summary cards, tables, and inline SVG charts.

    Uses .NET JavaScriptSerializer for deeply-nested JSON compatibility
    with PowerShell 5.1.

.PARAMETER InputDir
    Folder containing userId/sessionId.json files. Default: chats/incoming

.PARAMETER OutputFile
    Path for the generated HTML dashboard. Default: chats/stats.html

.EXAMPLE
    .\scripts\mhg-chat-stats.ps1
    .\scripts\mhg-chat-stats.ps1 -InputDir "chats/incoming" -OutputFile "chats/stats.html"
#>

param(
    [string]$InputDir   = "chats/incoming",
    [string]$OutputFile = "chats/stats.html"
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

function HtmlEncode {
    param([string]$Text)
    if (-not $Text) { return "" }
    return [System.Web.HttpUtility]::HtmlEncode($Text)
}

function Get-Median {
    param([double[]]$Values)
    if ($Values.Count -eq 0) { return 0 }
    $sorted = $Values | Sort-Object
    $mid = [int]($sorted.Count / 2)
    if ($sorted.Count % 2 -eq 0) {
        return ($sorted[$mid - 1] + $sorted[$mid]) / 2
    }
    return $sorted[$mid]
}

function Get-Percentile {
    param([double[]]$Values, [double]$P)
    if ($Values.Count -eq 0) { return 0 }
    $sorted = $Values | Sort-Object
    $idx = [Math]::Ceiling($P / 100.0 * $sorted.Count) - 1
    if ($idx -lt 0) { $idx = 0 }
    return $sorted[$idx]
}

function Build-SvgHistogram {
    param([double[]]$Values, [string]$Title, [string]$XLabel, [int]$BinCount = 10)

    if ($Values.Count -eq 0) { return "<p>No data</p>" }

    $minVal = ($Values | Measure-Object -Minimum).Minimum
    $maxVal = ($Values | Measure-Object -Maximum).Maximum
    if ($maxVal -eq $minVal) { $maxVal = $minVal + 1 }

    $binWidth = ($maxVal - $minVal) / $BinCount
    $bins = @(0) * $BinCount
    foreach ($v in $Values) {
        $idx = [int][Math]::Floor(($v - $minVal) / $binWidth)
        if ($idx -ge $BinCount) { $idx = $BinCount - 1 }
        $bins[$idx]++
    }
    $maxBin = ($bins | Measure-Object -Maximum).Maximum
    if ($maxBin -eq 0) { $maxBin = 1 }

    $svgW = 480; $svgH = 220; $pad = 50; $padBottom = 40; $padTop = 30
    $chartW = $svgW - $pad - 20; $chartH = $svgH - $padTop - $padBottom
    $barW = [Math]::Floor($chartW / $BinCount) - 2

    $sb = New-Object System.Text.StringBuilder
    [void]$sb.AppendLine("<svg width='$svgW' height='$svgH' xmlns='http://www.w3.org/2000/svg' style='background:#fff;border-radius:8px;border:1px solid #e5e7eb'>")
    [void]$sb.AppendLine("<text x='$([int]($svgW/2))' y='18' text-anchor='middle' font-size='13' font-weight='600' fill='#333'>$Title</text>")

    for ($i = 0; $i -lt $BinCount; $i++) {
        $barH = [int]($bins[$i] / $maxBin * $chartH)
        $x = $pad + $i * [int]($chartW / $BinCount) + 1
        $y = $padTop + $chartH - $barH
        [void]$sb.AppendLine("<rect x='$x' y='$y' width='$barW' height='$barH' fill='#3b82f6' rx='2'/>")
        if ($bins[$i] -gt 0) {
            [void]$sb.AppendLine("<text x='$([int]($x + $barW/2))' y='$($y - 3)' text-anchor='middle' font-size='10' fill='#555'>$($bins[$i])</text>")
        }
        $label = [Math]::Round($minVal + $i * $binWidth, 1)
        [void]$sb.AppendLine("<text x='$([int]($x + $barW/2))' y='$($padTop + $chartH + 14)' text-anchor='middle' font-size='9' fill='#888'>$label</text>")
    }
    # Axes
    [void]$sb.AppendLine("<line x1='$pad' y1='$padTop' x2='$pad' y2='$($padTop + $chartH)' stroke='#ccc'/>")
    [void]$sb.AppendLine("<line x1='$pad' y1='$($padTop + $chartH)' x2='$($svgW - 20)' y2='$($padTop + $chartH)' stroke='#ccc'/>")
    [void]$sb.AppendLine("<text x='$([int]($svgW/2))' y='$($svgH - 4)' text-anchor='middle' font-size='10' fill='#888'>$XLabel</text>")
    [void]$sb.AppendLine("</svg>")
    return $sb.ToString()
}

function Build-SvgBarChart {
    param([hashtable]$Data, [string]$Title, [int]$MaxBars = 15)

    $sorted = @($Data.GetEnumerator() | Sort-Object Value -Descending | Select-Object -First $MaxBars)
    if ($sorted.Count -eq 0) { return "<p>No data</p>" }

    $maxVal = ($sorted | Measure-Object -Property Value -Maximum).Maximum
    if ($maxVal -eq 0) { $maxVal = 1 }

    $barH = 22; $gap = 4; $padLeft = 120; $padRight = 50; $padTop = 30
    $svgW = 520
    $svgH = $padTop + ($barH + $gap) * $sorted.Count + 10
    $chartW = $svgW - $padLeft - $padRight

    $sb = New-Object System.Text.StringBuilder
    [void]$sb.AppendLine("<svg width='$svgW' height='$svgH' xmlns='http://www.w3.org/2000/svg' style='background:#fff;border-radius:8px;border:1px solid #e5e7eb'>")
    [void]$sb.AppendLine("<text x='$([int]($svgW/2))' y='18' text-anchor='middle' font-size='13' font-weight='600' fill='#333'>$Title</text>")

    $idx = 0
    foreach ($item in $sorted) {
        $y = $padTop + $idx * ($barH + $gap)
        $w = [int]($item.Value / $maxVal * $chartW)
        if ($w -lt 1) { $w = 1 }
        $label = $item.Key
        if ($label.Length -gt 16) { $label = $label.Substring(0, 8) + ".." + $label.Substring($label.Length - 6) }
        [void]$sb.AppendLine("<text x='$($padLeft - 4)' y='$($y + 15)' text-anchor='end' font-size='10' fill='#555'>$(HtmlEncode $label)</text>")
        [void]$sb.AppendLine("<rect x='$padLeft' y='$y' width='$w' height='$barH' fill='#22c55e' rx='3'/>")
        [void]$sb.AppendLine("<text x='$($padLeft + $w + 4)' y='$($y + 15)' font-size='10' fill='#333'>$($item.Value)</text>")
        $idx++
    }
    [void]$sb.AppendLine("</svg>")
    return $sb.ToString()
}

# --- Main ---
Write-Host "=== MHG Chat Statistics ===" -ForegroundColor Cyan
Write-Host "Input  : $InputDir"
Write-Host "Output : $OutputFile"
Write-Host ""

if (-not (Test-Path $InputDir)) {
    Write-Error "Input directory not found: $InputDir"
    exit 1
}

$jsonFiles = @(Get-ChildItem -Path $InputDir -Filter "*.json" -Recurse -File)
Write-Host "Found $($jsonFiles.Count) session files." -ForegroundColor Green

# Collect metrics
$durations        = [System.Collections.ArrayList]::new()
$msgCounts        = [System.Collections.ArrayList]::new()
$userMsgLengths   = [System.Collections.ArrayList]::new()
$assistMsgLengths = [System.Collections.ArrayList]::new()
$responseTimes    = [System.Collections.ArrayList]::new()
$sessionsPerUser  = @{}
$msgsPerUser      = @{}
$langBreakdown    = @{}
$statusBreakdown  = @{}
$totalSessions    = 0
$parseErrors      = 0

foreach ($file in $jsonFiles) {
    try {
        $session = Read-ChatJson -Path $file.FullName
        $totalSessions++

        $userId   = SafeGet $session @("userId")
        $status   = SafeGet $session @("status")
        $lang     = SafeGet (SafeGet $session @("metadata")) @("languageCode")
        $messages = SafeGet $session @("messages")

        # Per-user counts
        if ($userId) {
            if (-not $sessionsPerUser.ContainsKey($userId)) { $sessionsPerUser[$userId] = 0; $msgsPerUser[$userId] = 0 }
            $sessionsPerUser[$userId]++
        }

        # Language
        if ($lang) {
            if (-not $langBreakdown.ContainsKey($lang)) { $langBreakdown[$lang] = 0 }
            $langBreakdown[$lang]++
        }

        # Status
        if ($status) {
            if (-not $statusBreakdown.ContainsKey($status)) { $statusBreakdown[$status] = 0 }
            $statusBreakdown[$status]++
        }

        # Duration
        $startedAt = SafeGet $session @("startedAt")
        $endedAt   = SafeGet $session @("endedAt")
        if ($startedAt -and $endedAt) {
            try {
                $s = [datetime]::Parse($startedAt).ToUniversalTime()
                $e = [datetime]::Parse($endedAt).ToUniversalTime()
                [void]$durations.Add(($e - $s).TotalMinutes)
            } catch {}
        }

        # Messages
        $mCount = 0
        if ($messages) {
            $mCount = $messages.Count
            foreach ($msg in $messages) {
                $role    = SafeGet $msg @("role")
                $content = SafeGet $msg @("content")
                $rt      = SafeGet $msg @("responseTimeMs")

                $cLen = if ($content) { $content.Length } else { 0 }

                if ($role -eq "user") {
                    [void]$userMsgLengths.Add([double]$cLen)
                }
                elseif ($role -eq "assistant") {
                    [void]$assistMsgLengths.Add([double]$cLen)
                    if ($rt -and $rt -gt 0) {
                        [void]$responseTimes.Add([double]$rt)
                    }
                }
            }
            if ($userId) { $msgsPerUser[$userId] += $mCount }
        }
        [void]$msgCounts.Add([double]$mCount)
    }
    catch {
        Write-Warning "Could not parse $($file.FullName): $_"
        $parseErrors++
    }
}

# Compute aggregates
$uniqueUsers = $sessionsPerUser.Count
$durArr  = [double[]]$durations.ToArray()
$msgArr  = [double[]]$msgCounts.ToArray()
$umlArr  = [double[]]$userMsgLengths.ToArray()
$amlArr  = [double[]]$assistMsgLengths.ToArray()
$rtArr   = [double[]]$responseTimes.ToArray()

$avgDur  = if ($durArr.Count -gt 0) { [Math]::Round(($durArr | Measure-Object -Average).Average, 1) } else { 0 }
$medDur  = [Math]::Round((Get-Median $durArr), 1)
$minDur  = if ($durArr.Count -gt 0) { [Math]::Round(($durArr | Measure-Object -Minimum).Minimum, 1) } else { 0 }
$maxDur  = if ($durArr.Count -gt 0) { [Math]::Round(($durArr | Measure-Object -Maximum).Maximum, 1) } else { 0 }

$avgMsg  = if ($msgArr.Count -gt 0) { [Math]::Round(($msgArr | Measure-Object -Average).Average, 1) } else { 0 }
$medMsg  = [Math]::Round((Get-Median $msgArr), 1)
$minMsg  = if ($msgArr.Count -gt 0) { [int]($msgArr | Measure-Object -Minimum).Minimum } else { 0 }
$maxMsg  = if ($msgArr.Count -gt 0) { [int]($msgArr | Measure-Object -Maximum).Maximum } else { 0 }

$avgUml  = if ($umlArr.Count -gt 0) { [Math]::Round(($umlArr | Measure-Object -Average).Average, 0) } else { 0 }
$avgAml  = if ($amlArr.Count -gt 0) { [Math]::Round(($amlArr | Measure-Object -Average).Average, 0) } else { 0 }

$avgRt   = if ($rtArr.Count -gt 0) { [Math]::Round(($rtArr | Measure-Object -Average).Average, 0) } else { 0 }
$p50Rt   = [Math]::Round((Get-Percentile $rtArr 50), 0)
$p95Rt   = [Math]::Round((Get-Percentile $rtArr 95), 0)

# Print console summary
Write-Host ""
Write-Host "Total sessions : $totalSessions"
Write-Host "Unique users   : $uniqueUsers"
Write-Host "Avg duration   : $avgDur min"
Write-Host "Avg messages   : $avgMsg"
Write-Host "Parse errors   : $parseErrors"

# Build SVG charts
$durationHist   = Build-SvgHistogram -Values $durArr -Title "Session Duration Distribution" -XLabel "Duration (min)" -BinCount 8
$msgCountHist   = Build-SvgHistogram -Values $msgArr -Title "Messages Per Session" -XLabel "Message count" -BinCount 8
$sessPerUserBar = Build-SvgBarChart -Data $sessionsPerUser -Title "Sessions Per User"

# --- Build HTML ---
$css = @'
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f5f5f5; color: #1a1a1a; line-height: 1.5; padding: 24px; max-width: 1080px; margin: 0 auto; }
h1 { font-size: 1.4rem; margin-bottom: 16px; }
h2 { font-size: 1.1rem; margin: 24px 0 10px; }
.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 20px; }
.card { background: #fff; border-radius: 10px; padding: 16px 20px; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
.card .label { font-size: .78rem; color: #666; text-transform: uppercase; letter-spacing: .5px; }
.card .value { font-size: 1.6rem; font-weight: 700; color: #1e3a5f; margin-top: 2px; }
.card .sub { font-size: .78rem; color: #888; margin-top: 2px; }
table.data { width: 100%; border-collapse: collapse; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,.08); margin-bottom: 16px; }
table.data th { background: #f8fafc; text-align: left; padding: 8px 12px; font-size: .82rem; color: #555; border-bottom: 2px solid #e5e7eb; }
table.data td { padding: 6px 12px; font-size: .85rem; border-bottom: 1px solid #f1f5f9; }
table.data tr:last-child td { border-bottom: none; }
.charts { display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 20px; }
.charts svg { flex: 0 0 auto; }
.section { margin-bottom: 24px; }
'@

$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine("<!DOCTYPE html><html lang='en'><head><meta charset='utf-8'/>")
[void]$sb.AppendLine("<meta name='viewport' content='width=device-width,initial-scale=1'/>")
[void]$sb.AppendLine("<title>MHG Chat Statistics</title>")
[void]$sb.AppendLine("<style>$css</style></head><body>")
[void]$sb.AppendLine("<h1>MHG Chat Session Statistics</h1>")
[void]$sb.AppendLine("<p style='font-size:.85rem;color:#666;margin-bottom:16px'>Generated $(Get-Date -Format 'yyyy-MM-dd HH:mm') &mdash; $totalSessions sessions from $uniqueUsers users</p>")

# Summary cards
[void]$sb.AppendLine("<div class='cards'>")
[void]$sb.AppendLine("<div class='card'><div class='label'>Total Sessions</div><div class='value'>$totalSessions</div></div>")
[void]$sb.AppendLine("<div class='card'><div class='label'>Unique Users</div><div class='value'>$uniqueUsers</div></div>")
[void]$sb.AppendLine("<div class='card'><div class='label'>Avg Duration</div><div class='value'>${avgDur}m</div><div class='sub'>Med ${medDur}m &middot; Min ${minDur}m &middot; Max ${maxDur}m</div></div>")
[void]$sb.AppendLine("<div class='card'><div class='label'>Avg Messages</div><div class='value'>$avgMsg</div><div class='sub'>Med $medMsg &middot; Min $minMsg &middot; Max $maxMsg</div></div>")
[void]$sb.AppendLine("<div class='card'><div class='label'>Avg User Msg Length</div><div class='value'>$avgUml</div><div class='sub'>chars per message</div></div>")
[void]$sb.AppendLine("<div class='card'><div class='label'>Avg Assistant Msg Length</div><div class='value'>$avgAml</div><div class='sub'>chars per message</div></div>")
[void]$sb.AppendLine("<div class='card'><div class='label'>Response Time</div><div class='value'>${avgRt}ms</div><div class='sub'>p50 ${p50Rt}ms &middot; p95 ${p95Rt}ms</div></div>")
[void]$sb.AppendLine("</div>")

# Charts
[void]$sb.AppendLine("<div class='section'><h2>Distributions</h2><div class='charts'>")
[void]$sb.AppendLine($durationHist)
[void]$sb.AppendLine($msgCountHist)
[void]$sb.AppendLine("</div></div>")

[void]$sb.AppendLine("<div class='section'><h2>Sessions Per User</h2><div class='charts'>")
[void]$sb.AppendLine($sessPerUserBar)
[void]$sb.AppendLine("</div></div>")

# Sessions per user table
[void]$sb.AppendLine("<div class='section'><h2>User Breakdown</h2>")
[void]$sb.AppendLine("<table class='data'><thead><tr><th>User ID</th><th>Sessions</th><th>Total Messages</th></tr></thead><tbody>")
$sessionsPerUser.GetEnumerator() | Sort-Object Value -Descending | ForEach-Object {
    $uid = $_.Key
    $sc  = $_.Value
    $mc  = if ($msgsPerUser.ContainsKey($uid)) { $msgsPerUser[$uid] } else { 0 }
    [void]$sb.AppendLine("<tr><td style='word-break:break-all'>$(HtmlEncode $uid)</td><td>$sc</td><td>$mc</td></tr>")
}
[void]$sb.AppendLine("</tbody></table></div>")

# Language breakdown
if ($langBreakdown.Count -gt 0) {
    [void]$sb.AppendLine("<div class='section'><h2>Language Breakdown</h2>")
    [void]$sb.AppendLine("<table class='data'><thead><tr><th>Language</th><th>Sessions</th></tr></thead><tbody>")
    $langBreakdown.GetEnumerator() | Sort-Object Value -Descending | ForEach-Object {
        [void]$sb.AppendLine("<tr><td>$(HtmlEncode $_.Key)</td><td>$($_.Value)</td></tr>")
    }
    [void]$sb.AppendLine("</tbody></table></div>")
}

# Status breakdown
if ($statusBreakdown.Count -gt 0) {
    [void]$sb.AppendLine("<div class='section'><h2>Status Breakdown</h2>")
    [void]$sb.AppendLine("<table class='data'><thead><tr><th>Status</th><th>Sessions</th></tr></thead><tbody>")
    $statusBreakdown.GetEnumerator() | Sort-Object Value -Descending | ForEach-Object {
        [void]$sb.AppendLine("<tr><td>$(HtmlEncode $_.Key)</td><td>$($_.Value)</td></tr>")
    }
    [void]$sb.AppendLine("</tbody></table></div>")
}

[void]$sb.AppendLine("</body></html>")

# Write output
$outDir = [System.IO.Path]::GetDirectoryName((Resolve-Path -Path "." | Join-Path -ChildPath $OutputFile))
if ($outDir -and -not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Path $outDir -Force | Out-Null
}
[System.IO.File]::WriteAllText($OutputFile, $sb.ToString(), [System.Text.Encoding]::UTF8)

Write-Host ""
Write-Host "=== Dashboard written to $OutputFile ===" -ForegroundColor Green
Write-Host ""
