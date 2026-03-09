#!/bin/bash
#
# Database and Email Infrastructure Setup Script
#
# This script sets up Cloud SQL (PostgreSQL) and Gmail API for the chat application.
#
# Prerequisites:
# - gcloud CLI installed and authenticated
# - Sufficient permissions (Owner or Editor role)
#
# Usage:
#   ./setup-db.sh
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
echo "║     Database & Email Infrastructure Setup for Chat App       ║"
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

# Get or prompt for REGION
if [ -z "$REGION" ]; then
    REGION="europe-west1"
    read -p "Enter GCP region (default: $REGION): " INPUT_REGION
    if [ -n "$INPUT_REGION" ]; then
        REGION=$INPUT_REGION
    fi
fi

# Database configuration
DB_INSTANCE_NAME="chat-db"
DB_NAME="chat_app"
DB_USER="chat_user"

echo ""
echo "Configuration:"
echo "  Project ID:      $PROJECT_ID"
echo "  Project Number:  $PROJECT_NUMBER"
echo "  Region:          $REGION"
echo "  DB Instance:     $DB_INSTANCE_NAME"
echo "  Database:        $DB_NAME"
echo "  DB User:         $DB_USER"
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
    "sqladmin.googleapis.com"
    "sql-component.googleapis.com"
    "secretmanager.googleapis.com"
    "gmail.googleapis.com"
)

for api in "${APIs[@]}"; do
    log_info "Enabling $api..."
    gcloud services enable "$api" --quiet
done
log_success "All APIs enabled"

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "Step 2: Creating Cloud SQL PostgreSQL instance..."
echo "═══════════════════════════════════════════════════════════════"

if gcloud sql instances describe "$DB_INSTANCE_NAME" > /dev/null 2>&1; then
    log_warning "Cloud SQL instance '$DB_INSTANCE_NAME' already exists"
else
    # Generate a secure root password
    ROOT_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)
    
    log_info "Creating Cloud SQL instance (this may take several minutes)..."
    gcloud sql instances create "$DB_INSTANCE_NAME" \
        --database-version=POSTGRES_15 \
        --tier=db-f1-micro \
        --region="$REGION" \
        --storage-type=SSD \
        --storage-size=10GB \
        --availability-type=zonal \
        --root-password="$ROOT_PASSWORD"
    
    log_success "Cloud SQL instance created"
    echo ""
    echo "┌────────────────────────────────────────────────────────────────┐"
    echo "│ IMPORTANT: Save the root password securely!                    │"
    echo "│ Root Password: $ROOT_PASSWORD"
    echo "└────────────────────────────────────────────────────────────────┘"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "Step 3: Creating database and user..."
echo "═══════════════════════════════════════════════════════════════"

# Create database
if gcloud sql databases describe "$DB_NAME" --instance="$DB_INSTANCE_NAME" > /dev/null 2>&1; then
    log_warning "Database '$DB_NAME' already exists"
else
    log_info "Creating database '$DB_NAME'..."
    gcloud sql databases create "$DB_NAME" --instance="$DB_INSTANCE_NAME"
    log_success "Database created"
fi

# Create user
DB_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)

if gcloud sql users describe "$DB_USER" --instance="$DB_INSTANCE_NAME" > /dev/null 2>&1; then
    log_warning "User '$DB_USER' already exists"
    log_info "Updating password for user '$DB_USER'..."
    gcloud sql users set-password "$DB_USER" \
        --instance="$DB_INSTANCE_NAME" \
        --password="$DB_PASSWORD"
else
    log_info "Creating user '$DB_USER'..."
    gcloud sql users create "$DB_USER" \
        --instance="$DB_INSTANCE_NAME" \
        --password="$DB_PASSWORD"
fi

log_success "Database user configured"
echo ""
echo "┌────────────────────────────────────────────────────────────────┐"
echo "│ IMPORTANT: Save the database password securely!                │"
echo "│ DB User:     $DB_USER"
echo "│ DB Password: $DB_PASSWORD"
echo "└────────────────────────────────────────────────────────────────┘"

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "Step 4: Getting connection details..."
echo "═══════════════════════════════════════════════════════════════"

CONNECTION_NAME=$(gcloud sql instances describe "$DB_INSTANCE_NAME" --format="value(connectionName)")
log_success "Connection Name: $CONNECTION_NAME"

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "Step 5: Granting Cloud Run access to Cloud SQL..."
echo "═══════════════════════════════════════════════════════════════"

COMPUTE_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

log_info "Granting Cloud SQL Client role to $COMPUTE_SA..."
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$COMPUTE_SA" \
    --role="roles/cloudsql.client" \
    --quiet > /dev/null

log_success "Cloud SQL Client role granted"

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "Step 6: Creating secrets in Secret Manager..."
echo "═══════════════════════════════════════════════════════════════"

# Function to create or update secret
create_secret() {
    local SECRET_NAME=$1
    local SECRET_VALUE=$2
    
    if gcloud secrets describe "$SECRET_NAME" > /dev/null 2>&1; then
        log_info "Updating secret '$SECRET_NAME'..."
        echo -n "$SECRET_VALUE" | gcloud secrets versions add "$SECRET_NAME" --data-file=-
    else
        log_info "Creating secret '$SECRET_NAME'..."
        echo -n "$SECRET_VALUE" | gcloud secrets create "$SECRET_NAME" --data-file=-
    fi
}

# Generate JWT secrets
JWT_SECRET=$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)
JWT_REFRESH_SECRET=$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)

create_secret "db-password" "$DB_PASSWORD"
create_secret "jwt-secret" "$JWT_SECRET"
create_secret "jwt-refresh-secret" "$JWT_REFRESH_SECRET"

log_success "Secrets created"

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "Step 7: Granting Cloud Run access to secrets..."
echo "═══════════════════════════════════════════════════════════════"

SECRETS=("db-password" "jwt-secret" "jwt-refresh-secret")

for secret in "${SECRETS[@]}"; do
    log_info "Granting access to secret '$secret'..."
    gcloud secrets add-iam-policy-binding "$secret" \
        --member="serviceAccount:$COMPUTE_SA" \
        --role="roles/secretmanager.secretAccessor" \
        --quiet > /dev/null
done

log_success "Secret access granted"

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                    Setup Complete!                           ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "Database Configuration:"
echo "  Instance:        $DB_INSTANCE_NAME"
echo "  Connection Name: $CONNECTION_NAME"
echo "  Database:        $DB_NAME"
echo "  User:            $DB_USER"
echo ""
echo "Local Development (.env):"
echo "┌────────────────────────────────────────────────────────────────┐"
echo "DATABASE_URL=postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME"
echo "JWT_SECRET=$JWT_SECRET"
echo "JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET"
echo "└────────────────────────────────────────────────────────────────┘"
echo ""
echo "Cloud Run Environment Variables:"
echo "┌────────────────────────────────────────────────────────────────┐"
echo "DATABASE_URL=postgresql://$DB_USER:\${DB_PASSWORD}@/$DB_NAME?host=/cloudsql/$CONNECTION_NAME"
echo "└────────────────────────────────────────────────────────────────┘"
echo ""
echo "To run Cloud SQL Proxy locally:"
echo "  cloud-sql-proxy $CONNECTION_NAME --port=5432"
echo ""
log_warning "Gmail API Setup Required:"
echo "  1. Go to: https://console.cloud.google.com/apis/credentials"
echo "  2. Create OAuth 2.0 credentials (Web application)"
echo "  3. Add redirect URI: https://developers.google.com/oauthplayground"
echo "  4. Use OAuth Playground to get refresh token"
echo "  5. Add these secrets manually:"
echo "     - gmail-client-id"
echo "     - gmail-client-secret"
echo "     - gmail-refresh-token"
echo ""

