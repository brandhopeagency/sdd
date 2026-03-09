<#
.SYNOPSIS
    Download and filter MHG chat sessions from a GCS bucket.

.DESCRIPTION
    Downloads chat session files (.json + .jsonl) from the specified GCS bucket,
    then removes sessions that fall outside the date range or have fewer than
    the required number of user messages.

    Uses .NET JavaScriptSerializer to handle deeply-nested JSON that
    ConvertFrom-Json (PowerShell 5.1) cannot parse.

.PARAMETER Bucket
    GCS bucket name. Default: mental-help-global-25-chat-conversations

.PARAMETER Prefix
    Object prefix (subfolder) inside the bucket. Default: incoming

.PARAMETER AfterDate
    ISO date string (YYYY-MM-DD). Sessions with startedAt before this date are removed.
    Default: 2026-01-15

.PARAMETER MinUserMessages
    Minimum number of messages with role "user". Sessions below this threshold are removed.
    Default: 2

.PARAMETER OutputDir
    Local directory to store downloaded files. Default: chats

.PARAMETER SkipDownload
    Skip the gsutil download step and only run filters on already-downloaded files.

.EXAMPLE
    .\scripts\mhg-collect-chats.ps1
    .\scripts\mhg-collect-chats.ps1 -AfterDate "2026-02-01" -MinUserMessages 3
    .\scripts\mhg-collect-chats.ps1 -SkipDownload -MinUserMessages 3
#>

param(
    [string]$Bucket       = "mental-help-global-25-chat-conversations",
    [string]$Prefix       = "incoming",
    [string]$AfterDate    = "2026-01-15",
    [int]$MinUserMessages = 2,
    [string]$OutputDir    = "chats",
    [switch]$SkipDownload
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Web.Extensions

function Read-ChatJson {
    param([string]$Path)
    $raw = [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8)
    $ser = New-Object System.Web.Script.Serialization.JavaScriptSerializer
    $ser.MaxJsonLength = [int]::MaxValue
    $ser.RecursionLimit = 100
    return $ser.DeserializeObject($raw)
}

$cutoffDate = [datetime]::ParseExact(
    $AfterDate, "yyyy-MM-dd", $null,
    [System.Globalization.DateTimeStyles]::AssumeUniversal -bor
    [System.Globalization.DateTimeStyles]::AdjustToUniversal
)

Write-Host "=== MHG Chat Collector ===" -ForegroundColor Cyan
Write-Host "Bucket        : $Bucket"
Write-Host "Prefix        : $Prefix"
Write-Host "After date    : $($cutoffDate.ToString('yyyy-MM-dd')) UTC"
Write-Host "Min user msgs : $MinUserMessages"
Write-Host "Output dir    : $OutputDir"
Write-Host ""

# --- Step 1: Download --------------------------------------------------------
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

if (-not $SkipDownload) {
    $gsUri = "gs://$Bucket/$Prefix/"
    Write-Host "Downloading from $gsUri ..." -ForegroundColor Yellow
    gsutil -m cp -r $gsUri "$OutputDir/"
    if ($LASTEXITCODE -ne 0) {
        Write-Error "gsutil download failed with exit code $LASTEXITCODE"
        exit 1
    }
}
else {
    Write-Host "Skipping download (using existing files)." -ForegroundColor Yellow
}

$localRoot = Join-Path $OutputDir $Prefix

if (-not (Test-Path $localRoot)) {
    Write-Error "Local root not found: $localRoot"
    exit 1
}

# --- Step 2: Enumerate downloaded JSON files ----------------------------------
$allJsonFiles = @(Get-ChildItem -Path $localRoot -Filter "*.json" -Recurse -File)
$totalDownloaded = $allJsonFiles.Count
Write-Host ""
Write-Host "Found $totalDownloaded .json session files." -ForegroundColor Green

# --- Step 3: Filter by date ---------------------------------------------------
$removedByDate = 0

foreach ($file in $allJsonFiles) {
    try {
        $session = Read-ChatJson -Path $file.FullName
        $startedAtStr = $session["startedAt"]
        if (-not $startedAtStr) {
            Write-Warning "No startedAt in $($file.FullName) -- skipping date filter"
            continue
        }
        $startedAt = [datetime]::Parse($startedAtStr).ToUniversalTime()

        if ($startedAt -lt $cutoffDate) {
            Remove-Item -Path $file.FullName -Force
            $jsonlPair = $file.FullName -replace '\.json$', '.jsonl'
            if (Test-Path $jsonlPair) {
                Remove-Item -Path $jsonlPair -Force
            }
            $removedByDate++
        }
    }
    catch {
        Write-Warning "Could not parse $($file.FullName): $_"
    }
}

Write-Host "Removed $removedByDate sessions before $($cutoffDate.ToString('yyyy-MM-dd'))." -ForegroundColor Yellow

# --- Step 4: Filter by user message count -------------------------------------
$remainingJsonFiles = @(Get-ChildItem -Path $localRoot -Filter "*.json" -Recurse -File)
$removedByMsgCount = 0

foreach ($file in $remainingJsonFiles) {
    try {
        $session = Read-ChatJson -Path $file.FullName
        $messages = $session["messages"]
        $userMsgCount = 0
        if ($messages) {
            foreach ($msg in $messages) {
                if ($msg["role"] -eq "user") {
                    $userMsgCount++
                }
            }
        }

        if ($userMsgCount -lt $MinUserMessages) {
            Remove-Item -Path $file.FullName -Force
            $jsonlPair = $file.FullName -replace '\.json$', '.jsonl'
            if (Test-Path $jsonlPair) {
                Remove-Item -Path $jsonlPair -Force
            }
            $removedByMsgCount++
        }
    }
    catch {
        Write-Warning "Could not parse $($file.FullName): $_"
    }
}

Write-Host "Removed $removedByMsgCount sessions with fewer than $MinUserMessages user messages." -ForegroundColor Yellow

# --- Step 5: Clean up empty directories --------------------------------------
$dirs = @(Get-ChildItem -Path $localRoot -Directory -Recurse)
$dirs | Sort-Object { $_.FullName.Length } -Descending | ForEach-Object {
    $children = @(Get-ChildItem -Path $_.FullName -Recurse -File)
    if ($children.Count -eq 0) {
        Remove-Item -Path $_.FullName -Recurse -Force
    }
}

# --- Step 6: Summary ---------------------------------------------------------
$finalFiles = @(Get-ChildItem -Path $localRoot -Filter "*.json" -Recurse -File -ErrorAction SilentlyContinue)
$remaining = $finalFiles.Count

Write-Host ""
Write-Host "=== Summary ===" -ForegroundColor Cyan
Write-Host ("  Total found          : {0}" -f $totalDownloaded)
Write-Host ("  Removed (before date): {0}" -f $removedByDate)
Write-Host ("  Removed (< {0} user msgs) : {1}" -f $MinUserMessages, $removedByMsgCount)
Write-Host ("  Remaining            : {0}" -f $remaining) -ForegroundColor Green
Write-Host ""
