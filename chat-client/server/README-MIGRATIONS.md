# Database Migrations

## Applying Migrations

Migrations are automatically applied when the server starts. However, for existing databases in dev and prod environments, you may need to apply migrations manually.

### Option 1: Automatic (Recommended)

Migrations are automatically applied when the server starts via `initializeDatabase()`. Simply restart the server and the migration will be applied.

### Option 2: Manual Script

Use the migration script to apply a specific migration:

```bash
# Apply migration to dev environment
cd server
DATABASE_URL="your-dev-database-url" npm run db:migrate 004_add_feedback_to_messages.sql dev

# Apply migration to prod environment
DATABASE_URL="your-prod-database-url" npm run db:migrate 004_add_feedback_to_messages.sql prod
```

### Option 3: Direct SQL

Connect to your database and run the migration SQL directly:

```bash
# For dev
psql $DEV_DATABASE_URL -f src/db/migrations/004_add_feedback_to_messages.sql

# For prod
psql $PROD_DATABASE_URL -f src/db/migrations/004_add_feedback_to_messages.sql
```

### Option 4: Cloud SQL Proxy

If using Cloud SQL Proxy:

```bash
# Start proxy (in separate terminal)
cloud-sql-proxy PROJECT_ID:REGION:INSTANCE_NAME --port=5432

# Apply migration
DATABASE_URL="postgresql://user:password@localhost:5432/dbname" npm run db:migrate 004_add_feedback_to_messages.sql dev
```

## Migration: 004_add_feedback_to_messages.sql

This migration adds the `feedback` column to the `session_messages` table:

- **Column**: `feedback JSONB` (nullable for backward compatibility)
- **Purpose**: Store user feedback (rating 1-5 and optional comment) on messages
- **Backward Compatible**: Yes - existing messages will have `NULL` feedback

## Verifying Migration

After applying the migration, verify it was successful:

```sql
-- Check if column exists
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'session_messages' AND column_name = 'feedback';

-- Should return:
-- column_name | data_type | is_nullable
-- feedback    | jsonb     | YES
```

