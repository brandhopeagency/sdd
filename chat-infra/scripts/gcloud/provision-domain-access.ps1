param(
    [string]$ProjectId = "mental-help-global-25",
    [string]$ProdDomain = "mentalhelp.chat",
    [string]$ProdWwwDomain = "www.mentalhelp.chat",
    [string]$DevDomain = "dev.mentalhelp.chat",
    [string]$ProdDnsZone = "mentalhelp-chat"
)

$ErrorActionPreference = "Stop"

Write-Host "Provisioning UI domain access in project: $ProjectId"
gcloud config set project $ProjectId | Out-Null

$globalAddressName = "mentalhelp-domain-ip"
$certName = "mentalhelp-managed-cert-ui"
$httpsUrlMap = "mhg-domain-https-map"
$httpRedirectMap = "mhg-domain-http-redirect-map"
$httpsProxy = "mhg-domain-https-proxy"
$httpProxy = "mhg-domain-http-proxy"
$httpsForwardingRule = "mhg-domain-https-fr"
$httpForwardingRule = "mhg-domain-http-fr"
$prodBackendBucket = "bes-frontend-prod"
$devBackendBucket = "bes-frontend-dev"

gcloud compute addresses describe $globalAddressName --global --project $ProjectId *> $null
if ($LASTEXITCODE -ne 0) {
    gcloud compute addresses create $globalAddressName --global --ip-version=IPV4 --project $ProjectId | Out-Null
}
$globalIp = gcloud compute addresses describe $globalAddressName --global --project $ProjectId --format="value(address)"

gcloud compute backend-buckets describe $prodBackendBucket --project $ProjectId *> $null
if ($LASTEXITCODE -ne 0) {
    gcloud compute backend-buckets create $prodBackendBucket --gcs-bucket-name mental-help-global-25-frontend --enable-cdn --project $ProjectId | Out-Null
}

gcloud compute backend-buckets describe $devBackendBucket --project $ProjectId *> $null
if ($LASTEXITCODE -ne 0) {
    gcloud compute backend-buckets create $devBackendBucket --gcs-bucket-name mental-help-global-25-dev-frontend --enable-cdn --project $ProjectId | Out-Null
}

gcloud compute ssl-certificates describe $certName --global --project $ProjectId *> $null
if ($LASTEXITCODE -ne 0) {
    gcloud compute ssl-certificates create $certName --domains "$ProdDomain,$ProdWwwDomain,$DevDomain" --global --project $ProjectId | Out-Null
}

gcloud compute url-maps import $httpsUrlMap --global --source "D:/src/MHG/chat-infra/scripts/gcloud/url-map-https.yaml" --project $ProjectId --quiet | Out-Null
gcloud compute url-maps import $httpRedirectMap --global --source "D:/src/MHG/chat-infra/scripts/gcloud/url-map-http-redirect.yaml" --project $ProjectId --quiet | Out-Null

gcloud compute target-https-proxies describe $httpsProxy --project $ProjectId *> $null
if ($LASTEXITCODE -ne 0) {
    gcloud compute target-https-proxies create $httpsProxy --ssl-certificates $certName --url-map $httpsUrlMap --project $ProjectId | Out-Null
} else {
    gcloud compute target-https-proxies update $httpsProxy --ssl-certificates $certName --project $ProjectId | Out-Null
}

gcloud compute target-http-proxies describe $httpProxy --project $ProjectId *> $null
if ($LASTEXITCODE -ne 0) {
    gcloud compute target-http-proxies create $httpProxy --url-map $httpRedirectMap --project $ProjectId | Out-Null
}

gcloud compute forwarding-rules describe $httpsForwardingRule --global --project $ProjectId *> $null
if ($LASTEXITCODE -ne 0) {
    gcloud compute forwarding-rules create $httpsForwardingRule --global --address $globalAddressName --target-https-proxy $httpsProxy --ports 443 --project $ProjectId | Out-Null
}

gcloud compute forwarding-rules describe $httpForwardingRule --global --project $ProjectId *> $null
if ($LASTEXITCODE -ne 0) {
    gcloud compute forwarding-rules create $httpForwardingRule --global --address $globalAddressName --target-http-proxy $httpProxy --ports 80 --project $ProjectId | Out-Null
}

$records = @("$ProdDomain.", "$ProdWwwDomain.", "$DevDomain.")
foreach ($record in $records) {
    $existing = gcloud dns record-sets list --zone $ProdDnsZone --project $ProjectId --name $record --type A --format="value(name)"
    if ($existing) {
        gcloud dns record-sets update $record --zone $ProdDnsZone --project $ProjectId --type A --ttl 300 --rrdatas $globalIp | Out-Null
    } else {
        gcloud dns record-sets create $record --zone $ProdDnsZone --project $ProjectId --type A --ttl 300 --rrdatas $globalIp | Out-Null
    }
}

Write-Host "Provisioning complete."
Write-Host "Global IP: $globalIp"
Write-Host "Certificate: $certName (may stay PROVISIONING until DNS/validation completes)"
