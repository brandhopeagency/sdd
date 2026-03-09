param(
    [string]$ProjectId = "mental-help-global-25",
    [string]$Region = "europe-west1",
    [string]$WorkbenchProdDomain = "workbench.mentalhelp.chat",
    [string]$WorkbenchProdApiDomain = "api.workbench.mentalhelp.chat",
    [string]$WorkbenchDevDomain = "workbench.dev.mentalhelp.chat",
    [string]$WorkbenchDevApiDomain = "api.workbench.dev.mentalhelp.chat",
    [string]$DnsZone = "mentalhelp-chat"
)

$ErrorActionPreference = "Continue"

Write-Host "Provisioning workbench domain infrastructure in project: $ProjectId"
gcloud config set project $ProjectId | Out-Null

# ---------------------------------------------------------------------------
# Shared resource names (must match existing provisioning)
# ---------------------------------------------------------------------------
$globalAddressName = "mentalhelp-domain-ip"
$certName          = "mentalhelp-managed-cert-ui"
$httpsUrlMap       = "mhg-domain-https-map"

# ---------------------------------------------------------------------------
# Workbench-specific resource names
# ---------------------------------------------------------------------------
# Frontend GCS buckets
$workbenchProdBucketName = "mental-help-global-25-workbench-frontend"
$workbenchDevBucketName  = "mental-help-global-25-dev-workbench-frontend"

# Backend buckets (GCS-backed, for frontend static assets)
$workbenchProdBackendBucket = "bes-frontend-workbench-prod"
$workbenchDevBackendBucket  = "bes-frontend-workbench-dev"

# Cloud Run services (same image as chat-backend, different SERVICE_SURFACE)
$workbenchProdCloudRunService = "workbench-backend"
$workbenchDevCloudRunService  = "workbench-backend-dev"

# Serverless NEGs
$workbenchProdNeg = "neg-workbench-api-prod"
$workbenchDevNeg  = "neg-workbench-api-dev"

# Backend services (serverless NEG-backed, for API traffic)
$workbenchProdApiBackendService = "bes-workbench-api-prod"
$workbenchDevApiBackendService  = "bes-workbench-api-dev"

# ---------------------------------------------------------------------------
# Resolve global IP
# ---------------------------------------------------------------------------
$globalIp = gcloud compute addresses describe $globalAddressName --global --project $ProjectId --format="value(address)"
Write-Host "Global IP: $globalIp"

# ===========================================================================
# 1. GCS buckets for workbench frontend
# ===========================================================================
Write-Host "`n--- Creating GCS buckets ---"

gsutil ls -b "gs://$workbenchProdBucketName" *> $null
if ($LASTEXITCODE -ne 0) {
    gsutil mb -p $ProjectId -l $Region -b on "gs://$workbenchProdBucketName"
    gsutil iam ch allUsers:objectViewer "gs://$workbenchProdBucketName"
    gsutil web set -m index.html -e index.html "gs://$workbenchProdBucketName"
    Write-Host "  Created bucket: $workbenchProdBucketName"
} else {
    Write-Host "  Bucket already exists: $workbenchProdBucketName"
}

gsutil ls -b "gs://$workbenchDevBucketName" *> $null
if ($LASTEXITCODE -ne 0) {
    gsutil mb -p $ProjectId -l $Region -b on "gs://$workbenchDevBucketName"
    gsutil iam ch allUsers:objectViewer "gs://$workbenchDevBucketName"
    gsutil web set -m index.html -e index.html "gs://$workbenchDevBucketName"
    Write-Host "  Created bucket: $workbenchDevBucketName"
} else {
    Write-Host "  Bucket already exists: $workbenchDevBucketName"
}

# ===========================================================================
# 2. Backend buckets (frontend static hosting via GCS)
# ===========================================================================
Write-Host "`n--- Creating backend buckets ---"

gcloud compute backend-buckets describe $workbenchProdBackendBucket --project $ProjectId *> $null
if ($LASTEXITCODE -ne 0) {
    gcloud compute backend-buckets create $workbenchProdBackendBucket `
        --gcs-bucket-name $workbenchProdBucketName `
        --enable-cdn `
        --project $ProjectId | Out-Null
    Write-Host "  Created backend bucket: $workbenchProdBackendBucket"
} else {
    Write-Host "  Backend bucket already exists: $workbenchProdBackendBucket"
}

gcloud compute backend-buckets describe $workbenchDevBackendBucket --project $ProjectId *> $null
if ($LASTEXITCODE -ne 0) {
    gcloud compute backend-buckets create $workbenchDevBackendBucket `
        --gcs-bucket-name $workbenchDevBucketName `
        --enable-cdn `
        --project $ProjectId | Out-Null
    Write-Host "  Created backend bucket: $workbenchDevBackendBucket"
} else {
    Write-Host "  Backend bucket already exists: $workbenchDevBackendBucket"
}

# ===========================================================================
# 3. Serverless NEGs for workbench Cloud Run services
# ===========================================================================
Write-Host "`n--- Creating serverless NEGs ---"

gcloud compute network-endpoint-groups describe $workbenchProdNeg --region $Region --project $ProjectId *> $null
if ($LASTEXITCODE -ne 0) {
    gcloud compute network-endpoint-groups create $workbenchProdNeg `
        --region $Region `
        --network-endpoint-type serverless `
        --cloud-run-service $workbenchProdCloudRunService `
        --project $ProjectId | Out-Null
    Write-Host "  Created NEG: $workbenchProdNeg -> $workbenchProdCloudRunService"
} else {
    Write-Host "  NEG already exists: $workbenchProdNeg"
}

gcloud compute network-endpoint-groups describe $workbenchDevNeg --region $Region --project $ProjectId *> $null
if ($LASTEXITCODE -ne 0) {
    gcloud compute network-endpoint-groups create $workbenchDevNeg `
        --region $Region `
        --network-endpoint-type serverless `
        --cloud-run-service $workbenchDevCloudRunService `
        --project $ProjectId | Out-Null
    Write-Host "  Created NEG: $workbenchDevNeg -> $workbenchDevCloudRunService"
} else {
    Write-Host "  NEG already exists: $workbenchDevNeg"
}

# ===========================================================================
# 4. Backend services for workbench API (serverless NEG-backed)
# ===========================================================================
Write-Host "`n--- Creating backend services ---"

gcloud compute backend-services describe $workbenchProdApiBackendService --global --project $ProjectId *> $null
if ($LASTEXITCODE -ne 0) {
    gcloud compute backend-services create $workbenchProdApiBackendService `
        --global `
        --load-balancing-scheme EXTERNAL_MANAGED `
        --protocol HTTP `
        --project $ProjectId | Out-Null
    gcloud compute backend-services add-backend $workbenchProdApiBackendService `
        --global `
        --network-endpoint-group $workbenchProdNeg `
        --network-endpoint-group-region $Region `
        --project $ProjectId | Out-Null
    Write-Host "  Created backend service: $workbenchProdApiBackendService"
} else {
    Write-Host "  Backend service already exists: $workbenchProdApiBackendService"
}

gcloud compute backend-services describe $workbenchDevApiBackendService --global --project $ProjectId *> $null
if ($LASTEXITCODE -ne 0) {
    gcloud compute backend-services create $workbenchDevApiBackendService `
        --global `
        --load-balancing-scheme EXTERNAL_MANAGED `
        --protocol HTTP `
        --project $ProjectId | Out-Null
    gcloud compute backend-services add-backend $workbenchDevApiBackendService `
        --global `
        --network-endpoint-group $workbenchDevNeg `
        --network-endpoint-group-region $Region `
        --project $ProjectId | Out-Null
    Write-Host "  Created backend service: $workbenchDevApiBackendService"
} else {
    Write-Host "  Backend service already exists: $workbenchDevApiBackendService"
}

# ===========================================================================
# 5. DNS records for workbench domains
# ===========================================================================
Write-Host "`n--- Configuring DNS records ---"

$workbenchRecords = @(
    "$WorkbenchProdDomain.",
    "$WorkbenchProdApiDomain.",
    "$WorkbenchDevDomain.",
    "$WorkbenchDevApiDomain."
)

foreach ($record in $workbenchRecords) {
    $existing = gcloud dns record-sets list --zone $DnsZone --project $ProjectId --name $record --type A --format="value(name)"
    if ($existing) {
        gcloud dns record-sets update $record --zone $DnsZone --project $ProjectId --type A --ttl 300 --rrdatas $globalIp | Out-Null
        Write-Host "  Updated DNS record: $record -> $globalIp"
    } else {
        gcloud dns record-sets create $record --zone $DnsZone --project $ProjectId --type A --ttl 300 --rrdatas $globalIp | Out-Null
        Write-Host "  Created DNS record: $record -> $globalIp"
    }
}

# ===========================================================================
# 6. Update SSL certificate to include workbench domains (zero-downtime)
# ===========================================================================
Write-Host "`n--- Updating SSL certificate (zero-downtime rotation) ---"

# Google-managed certificates are immutable. To add domains we must create
# a NEW certificate, wait for it to become ACTIVE, switch the HTTPS proxy
# to the new cert, then optionally delete the old one. This avoids the
# 15-60+ minute HTTPS outage that a delete-and-recreate pattern causes.
$allDomains = @(
    "mentalhelp.chat",
    "www.mentalhelp.chat",
    "dev.mentalhelp.chat",
    $WorkbenchProdDomain,
    $WorkbenchProdApiDomain,
    $WorkbenchDevDomain,
    $WorkbenchDevApiDomain
)
$domainsCsv = $allDomains -join ","

# Use a versioned cert name for the new certificate
$newCertName = "$certName-v2"

gcloud compute ssl-certificates describe $newCertName --global --project $ProjectId *> $null 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "  Creating new certificate: $newCertName with domains: $domainsCsv"
    gcloud compute ssl-certificates create $newCertName `
        --domains $domainsCsv `
        --global `
        --project $ProjectId | Out-Null
} else {
    Write-Host "  Certificate $newCertName already exists."
}

Write-Host "  IMPORTANT: Wait for the new certificate to reach ACTIVE status before updating the HTTPS proxy."
Write-Host "  Check status: gcloud compute ssl-certificates describe $newCertName --global --project $ProjectId --format='value(managed.status)'"
Write-Host "  Once ACTIVE, update the HTTPS proxy to use the new certificate:"
Write-Host "    gcloud compute target-https-proxies update mhg-domain-https-proxy --ssl-certificates=$newCertName --global --project $ProjectId"
Write-Host "  Then optionally delete the old certificate:"
Write-Host "    gcloud compute ssl-certificates delete $certName --global --project $ProjectId --quiet"

# ===========================================================================
# 7. Import updated URL map
# ===========================================================================
Write-Host "`n--- Importing URL map ---"

$urlMapYamlPath = Join-Path $PSScriptRoot "url-map-https.yaml"
gcloud compute url-maps import $httpsUrlMap `
    --global `
    --source $urlMapYamlPath `
    --project $ProjectId `
    --quiet | Out-Null
Write-Host "  URL map imported from: $urlMapYamlPath"

# ===========================================================================
# Done
# ===========================================================================
Write-Host "`nWorkbench domain provisioning complete."
Write-Host "Global IP:    $globalIp"
Write-Host "Certificate:  $certName (may remain PROVISIONING until DNS validation completes)"
Write-Host "`nWorkbench domains:"
Write-Host "  Prod FE:  $WorkbenchProdDomain"
Write-Host "  Prod API: $WorkbenchProdApiDomain"
Write-Host "  Dev FE:   $WorkbenchDevDomain"
Write-Host "  Dev API:  $WorkbenchDevApiDomain"
