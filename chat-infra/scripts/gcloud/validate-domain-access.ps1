param(
    [string]$ProjectId = "mental-help-global-25",
    [string]$ProductionUrl = "https://mentalhelp.chat",
    [string]$ProductionWwwUrl = "https://www.mentalhelp.chat",
    [string]$ProductionHttpUrl = "http://mentalhelp.chat",
    [string]$DevelopmentUrl = "https://dev.mentalhelp.chat"
)

$ErrorActionPreference = "Stop"

Write-Host "Validating domain access configuration for project: $ProjectId"
gcloud config set project $ProjectId | Out-Null

Write-Host "Listing SSL certificates..."
gcloud compute ssl-certificates list

Write-Host "Listing URL maps..."
gcloud compute url-maps list

Write-Host "Checking production canonical endpoint..."
$prodResponse = Invoke-WebRequest -Uri $ProductionUrl -Method Head -MaximumRedirection 0 -ErrorAction SilentlyContinue
if (-not $prodResponse.StatusCode) {
    throw "Unable to validate production endpoint: $ProductionUrl"
}

Write-Host "Checking www redirect target..."
$wwwResponse = Invoke-WebRequest -Uri $ProductionWwwUrl -Method Head -MaximumRedirection 0 -ErrorAction SilentlyContinue
if ($wwwResponse.StatusCode -lt 300 -or $wwwResponse.StatusCode -gt 399) {
    throw "Expected redirect from $ProductionWwwUrl but got status $($wwwResponse.StatusCode)"
}

if ($wwwResponse.Headers.Location -notmatch "mentalhelp\.chat") {
    throw "WWW redirect target is not canonical mentalhelp.chat"
}

Write-Host "Checking HTTP to HTTPS redirect..."
$httpResponse = Invoke-WebRequest -Uri $ProductionHttpUrl -Method Head -MaximumRedirection 0 -ErrorAction SilentlyContinue
if ($httpResponse.StatusCode -lt 300 -or $httpResponse.StatusCode -gt 399) {
    throw "Expected HTTPS redirect from $ProductionHttpUrl but got status $($httpResponse.StatusCode)"
}

if ($httpResponse.Headers.Location -notmatch "^https://") {
    throw "HTTP endpoint did not redirect to HTTPS"
}

Write-Host "Checking development UI endpoint..."
$devResponse = Invoke-WebRequest -Uri $DevelopmentUrl -Method Head -MaximumRedirection 0 -ErrorAction SilentlyContinue
if (-not $devResponse.StatusCode) {
    throw "Unable to validate development endpoint: $DevelopmentUrl"
}

Write-Host "Checking certificate status and expiry window..."
$certificatesJson = gcloud compute ssl-certificates list --format=json
$certificates = $certificatesJson | ConvertFrom-Json

if (-not $certificates -or $certificates.Count -eq 0) {
    throw "No SSL certificates found in project $ProjectId"
}

$activeCerts = @($certificates | Where-Object { $_.managed.status -eq "ACTIVE" })
if ($activeCerts.Count -eq 0) {
    throw "No ACTIVE managed SSL certificates found."
}

$now = Get-Date
$minDays = 14
foreach ($cert in $activeCerts) {
    if ($cert.expireTime) {
        $expires = Get-Date $cert.expireTime
        $daysRemaining = ($expires - $now).TotalDays
        if ($daysRemaining -lt $minDays) {
            throw "Certificate $($cert.name) expires in less than $minDays days."
        }
    }
}

Write-Host "Domain validation checks completed successfully."
