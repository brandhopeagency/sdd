#!/bin/bash

# ============================================
# GCS Storage Setup for Conversations
# ============================================
# This script creates a GCS bucket for storing
# conversation data and configures permissions

set -e

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ gcloud CLI is not installed"
    exit 1
fi

# Get project ID
PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
if [ -z "$PROJECT_ID" ]; then
    echo "❌ No project configured. Run: gcloud config set project PROJECT_ID"
    exit 1
fi

# Get project number
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)")

# Configuration
REGION="${REGION:-europe-west1}"
BUCKET_NAME="${PROJECT_ID}-chat-conversations"

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║              GCS Storage Setup for Conversations               ║"
echo "╠════════════════════════════════════════════════════════════════╣"
echo "║  Project ID: $PROJECT_ID"
echo "║  Region: $REGION"
echo "║  Bucket: $BUCKET_NAME"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Create GCS bucket
echo "🪣 Creating GCS bucket..."
if gsutil ls -b "gs://${BUCKET_NAME}" &>/dev/null; then
    echo "✓ Bucket already exists: gs://${BUCKET_NAME}"
else
    gsutil mb -p "${PROJECT_ID}" -c STANDARD -l "${REGION}" -b on "gs://${BUCKET_NAME}"
    echo "✓ Created bucket: gs://${BUCKET_NAME}"
fi

# Set bucket lifecycle policy (move to Coldline after 90 days)
echo ""
echo "📅 Setting lifecycle policy..."
cat > /tmp/lifecycle.json <<EOF
{
  "lifecycle": {
    "rule": [
      {
        "action": {
          "type": "SetStorageClass",
          "storageClass": "COLDLINE"
        },
        "condition": {
          "age": 90,
          "matchesPrefix": ["incoming/"]
        }
      }
    ]
  }
}
EOF

gsutil lifecycle set /tmp/lifecycle.json "gs://${BUCKET_NAME}"
rm /tmp/lifecycle.json
echo "✓ Lifecycle policy configured (COLDLINE after 90 days)"

# Enable uniform bucket-level access
echo ""
echo "🔒 Configuring bucket access..."
gsutil uniformbucketlevelaccess set on "gs://${BUCKET_NAME}"
echo "✓ Uniform bucket-level access enabled"

# Grant Cloud Run service account access
echo ""
echo "🔑 Granting Cloud Run service account access..."
SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

# Add storage.objectAdmin role
gsutil iam ch "serviceAccount:${SERVICE_ACCOUNT}:roles/storage.objectAdmin" "gs://${BUCKET_NAME}"
echo "✓ Granted storage.objectAdmin to ${SERVICE_ACCOUNT}"

# Test write access
echo ""
echo "🧪 Testing write access..."
echo "test" | gsutil cp - "gs://${BUCKET_NAME}/test.txt"
gsutil rm "gs://${BUCKET_NAME}/test.txt"
echo "✓ Write access verified"

# Create folder structure
echo ""
echo "📁 Creating folder structure..."
echo "" | gsutil cp - "gs://${BUCKET_NAME}/incoming/.keep"
echo "✓ Created incoming/ folder"

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                       Setup Complete!                          ║"
echo "╠════════════════════════════════════════════════════════════════╣"
echo "║  Bucket: gs://$BUCKET_NAME"
echo "║  Region: $REGION"
echo "║  Storage Class: STANDARD → COLDLINE (90 days)"
echo "║  Service Account: ${SERVICE_ACCOUNT}"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "Next steps:"
echo "1. Set GCS_BUCKET_NAME environment variable in your application:"
echo "   export GCS_BUCKET_NAME=\"$BUCKET_NAME\""
echo ""
echo "2. Add to GitHub secrets/variables:"
echo "   gh variable set GCS_BUCKET_NAME --body \"$BUCKET_NAME\" --env dev"
echo "   gh variable set GCS_BUCKET_NAME --body \"$BUCKET_NAME\" --env prod"
echo ""

