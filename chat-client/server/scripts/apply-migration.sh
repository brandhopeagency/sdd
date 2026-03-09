#!/bin/bash

# Script to apply database migration
# Usage: ./apply-migration.sh [migration-file] [environment]
# Example: ./apply-migration.sh 004_add_feedback_to_messages.sql dev

set -e

MIGRATION_FILE=${1:-"004_add_feedback_to_messages.sql"}
ENVIRONMENT=${2:-"dev"}

if [ -z "$DATABASE_URL" ]; then
    echo "Error: DATABASE_URL environment variable is not set"
    echo "Please set DATABASE_URL for $ENVIRONMENT environment"
    exit 1
fi

MIGRATION_PATH="src/db/migrations/$MIGRATION_FILE"

if [ ! -f "$MIGRATION_PATH" ]; then
    echo "Error: Migration file not found: $MIGRATION_PATH"
    exit 1
fi

echo "Applying migration $MIGRATION_FILE to $ENVIRONMENT environment..."
echo "Database: $DATABASE_URL"
echo ""

# Apply migration using psql
psql "$DATABASE_URL" -f "$MIGRATION_PATH"

echo ""
echo "✓ Migration $MIGRATION_FILE applied successfully to $ENVIRONMENT"

