#!/bin/bash
#
# GCP Infrastructure Setup Script for Mental Health Chat Application
#
# This script sets up all required GCP resources for deploying:
# - Frontend: Cloud Storage + CDN
# - Backend: Cloud Run
# - CI/CD: GitHub Actions with Workload Identity Federation
#
# Prerequisites:
# - gcloud CLI installed and authenticated
# - Sufficient permissions (Owner or Editor role)
#
# Usage:
#   ./setup.sh
#
# You will be prompted for required values if not set as environment variables.
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    log_error "gcloud CLI is not installed. Please install it first:"
    echo "  https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check if authenticated
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | head -n1 > /dev/null 2>&1; then
    log_error "Not authenticated with gcloud. Run: gcloud auth login"
    exit 1
fi

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║        GCP Infrastructure Setup for Chat Application         ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Get or prompt for PROJECT_ID
if [ -z "$PROJECT_ID" ]; then
    CURRENT_PROJECT=$(gcloud config get-value project 2>/dev/null)
    if [ -n "$CURRENT_PROJECT" ]; then
        read -p "Use current project '$CURRENT_PROJECT'? (Y/n): " USE_CURRENT
        if [ "$USE_CURRENT" != "n" ] && [ "$USE_CURRENT" != "N" ]; then
            PROJECT_ID=$CURRENT_PROJECT
        fi
    fi
    
    if [ -z "$PROJECT_ID" ]; then
        read -p "Enter GCP Project ID: " PROJECT_ID
    fi
fi

# Validate project exists
if ! gcloud projects describe "$PROJECT_ID" > /dev/null 2>&1; then
    log_error "Project '$PROJECT_ID' not found or you don't have access"
    exit 1
fi

# Get PROJECT_NUMBER
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)")

# Get or prompt for GITHUB_REPO
if [ -z "$GITHUB_REPO" ]; then
    echo ""
    log_info "GitHub repository format: owner/repo-name"
    log_info "Example: mycompany/chat-client"
    read -p "Enter your GitHub repository: " GITHUB_REPO
fi

# Validate GitHub repo format
if [[ ! "$GITHUB_REPO" =~ ^[a-zA-Z0-9_-]+/[a-zA-Z0-9_.-]+$ ]]; then
    log_error "Invalid GitHub repository format. Use: owner/repo-name"
    exit 1
fi

# Get or prompt for REGION
if [ -z "$REGION" ]; then
    REGION="europe-west1"
    read -p "Enter GCP region (default: $REGION): " INPUT_REGION
    if [ -n "$INPUT_REGION" ]; then
        REGION=$INPUT_REGION
    fi
fi

# Get or prompt for BUCKET_NAME
if [ -z "$BUCKET_NAME" ]; then
    BUCKET_NAME="${PROJECT_ID}-frontend"
    read -p "Enter Cloud Storage bucket name (default: $BUCKET_NAME): " INPUT_BUCKET
    if [ -n "$INPUT_BUCKET" ]; then
        BUCKET_NAME=$INPUT_BUCKET
    fi
fi

echo ""
echo "Configuration:"
echo "  Project ID:     $PROJECT_ID"
echo "  Project Number: $PROJECT_NUMBER"
echo "  GitHub Repo:    $GITHUB_REPO"
echo "  Region:         $REGION"
echo "  Bucket Name:    $BUCKET_NAME"
echo ""
read -p "Continue with this configuration? (Y/n): " CONFIRM
if [ "$CONFIRM" = "n" ] || [ "$CONFIRM" = "N" ]; then
    echo "Aborted."
    exit 0
fi

# Set project
gcloud config set project "$PROJECT_ID"

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "Step 1: Enabling required APIs..."
echo "═══════════════════════════════════════════════════════════════"

APIs=(
    "storage.googleapis.com"
    "run.googleapis.com"
    "artifactregistry.googleapis.com"
    "iamcredentials.googleapis.com"
    "cloudresourcemanager.googleapis.com"
    "iam.googleapis.com"
)

for api in "${APIs[@]}"; do
    log_info "Enabling $api..."
    gcloud services enable "$api" --quiet
done
log_success "All APIs enabled"

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "Step 2: Creating Cloud Storage bucket for frontend..."
echo "═══════════════════════════════════════════════════════════════"

if gcloud storage buckets describe "gs://$BUCKET_NAME" > /dev/null 2>&1; then
    log_warning "Bucket gs://$BUCKET_NAME already exists"
else
    log_info "Creating bucket gs://$BUCKET_NAME..."
    gcloud storage buckets create "gs://$BUCKET_NAME" \
        --location="$REGION" \
        --uniform-bucket-level-access
    log_success "Bucket created"
fi

log_info "Setting public access..."
gcloud storage buckets add-iam-policy-binding "gs://$BUCKET_NAME" \
    --member=allUsers \
    --role=roles/storage.objectViewer \
    --quiet
log_success "Bucket is publicly readable"

# Configure for SPA hosting
log_info "Configuring bucket for SPA hosting..."
gcloud storage buckets update "gs://$BUCKET_NAME" \
    --web-main-page-suffix=index.html \
    --web-error-page=index.html
log_success "SPA hosting configured"

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "Step 3: Creating Artifact Registry repository..."
echo "═══════════════════════════════════════════════════════════════"

REPO_NAME="chat-backend"
if gcloud artifacts repositories describe "$REPO_NAME" --location="$REGION" > /dev/null 2>&1; then
    log_warning "Repository $REPO_NAME already exists"
else
    log_info "Creating Docker repository..."
    gcloud artifacts repositories create "$REPO_NAME" \
        --repository-format=docker \
        --location="$REGION" \
        --description="Docker images for chat backend"
    log_success "Repository created"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "Step 4: Setting up Workload Identity Federation..."
echo "═══════════════════════════════════════════════════════════════"

POOL_NAME="github-pool"
PROVIDER_NAME="github-provider"

# Create WIF pool
if gcloud iam workload-identity-pools describe "$POOL_NAME" --location="global" > /dev/null 2>&1; then
    log_warning "Workload Identity Pool '$POOL_NAME' already exists"
else
    log_info "Creating Workload Identity Pool..."
    gcloud iam workload-identity-pools create "$POOL_NAME" \
        --location="global" \
        --display-name="GitHub Actions Pool" \
        --description="Pool for GitHub Actions authentication"
    log_success "Pool created"
fi

# Create WIF provider
if gcloud iam workload-identity-pools providers describe "$PROVIDER_NAME" \
    --location="global" \
    --workload-identity-pool="$POOL_NAME" > /dev/null 2>&1; then
    log_warning "Provider '$PROVIDER_NAME' already exists"
else
    log_info "Creating OIDC Provider..."
    gcloud iam workload-identity-pools providers create-oidc "$PROVIDER_NAME" \
        --location="global" \
        --workload-identity-pool="$POOL_NAME" \
        --display-name="GitHub provider" \
        --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
        --attribute-condition="assertion.repository=='$GITHUB_REPO'" \
        --issuer-uri="https://token.actions.githubusercontent.com"
    log_success "Provider created"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "Step 5: Creating Service Account for GitHub Actions..."
echo "═══════════════════════════════════════════════════════════════"

SA_NAME="github-actions-sa"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

if gcloud iam service-accounts describe "$SA_EMAIL" > /dev/null 2>&1; then
    log_warning "Service Account $SA_NAME already exists"
else
    log_info "Creating Service Account..."
    gcloud iam service-accounts create "$SA_NAME" \
        --display-name="GitHub Actions Service Account" \
        --description="Service account for GitHub Actions CI/CD"
    log_success "Service Account created"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "Step 6: Granting IAM roles to Service Account..."
echo "═══════════════════════════════════════════════════════════════"

ROLES=(
    "roles/storage.objectAdmin"
    "roles/run.admin"
    "roles/artifactregistry.writer"
    "roles/dialogflow.client"
)

for role in "${ROLES[@]}"; do
    log_info "Granting $role..."
    gcloud projects add-iam-policy-binding "$PROJECT_ID" \
        --member="serviceAccount:$SA_EMAIL" \
        --role="$role" \
        --quiet > /dev/null
done
log_success "Project-level roles granted"

# Grant actAs permission for Cloud Run default compute service account
log_info "Granting actAs permission for Cloud Run..."
COMPUTE_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
gcloud iam service-accounts add-iam-policy-binding "$COMPUTE_SA" \
    --member="serviceAccount:$SA_EMAIL" \
    --role="roles/iam.serviceAccountUser" \
    --quiet > /dev/null
log_success "actAs permission granted"

# Grant Dialogflow access to Cloud Run's default compute service account
log_info "Granting Dialogflow access to Cloud Run service account..."
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$COMPUTE_SA" \
    --role="roles/dialogflow.client" \
    --quiet > /dev/null
log_success "Dialogflow access granted to Cloud Run"

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "Step 7: Binding Workload Identity to Service Account..."
echo "═══════════════════════════════════════════════════════════════"

WIF_MEMBER="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_NAME}/attribute.repository/${GITHUB_REPO}"

log_info "Binding WIF to Service Account..."
gcloud iam service-accounts add-iam-policy-binding "$SA_EMAIL" \
    --member="$WIF_MEMBER" \
    --role="roles/iam.workloadIdentityUser" \
    --quiet > /dev/null
log_success "WIF binding complete"

# Generate WIF provider path for GitHub secrets
WIF_PROVIDER="projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_NAME}/providers/${PROVIDER_NAME}"

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                    Setup Complete!                           ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "Add these secrets to your GitHub repository:"
echo "(Settings → Secrets and variables → Actions → New repository secret)"
echo ""
echo "┌────────────────────────────────────────────────────────────────┐"
echo "│ Secret Name              │ Value                               "
echo "├────────────────────────────────────────────────────────────────┤"
echo "│ GCP_PROJECT_ID           │ $PROJECT_ID"
echo "│ GCP_WIF_PROVIDER         │ $WIF_PROVIDER"
echo "│ GCP_SERVICE_ACCOUNT      │ $SA_EMAIL"
echo "│ GCS_BUCKET               │ $BUCKET_NAME"
echo "│ BACKEND_URL              │ (will be available after first deploy)"
echo "│ FRONTEND_URL             │ https://storage.googleapis.com/$BUCKET_NAME"
echo "└────────────────────────────────────────────────────────────────┘"
echo ""
echo "Frontend URL: https://storage.googleapis.com/$BUCKET_NAME"
echo ""
log_info "Don't forget to add Dialogflow secrets:"
echo "  - DIALOGFLOW_PROJECT_ID"
echo "  - DIALOGFLOW_AGENT_ID"
echo "  - DIALOGFLOW_LOCATION"
echo ""

