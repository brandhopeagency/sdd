-- 016_add_supervisor_role.sql
-- Adds 'supervisor' to the user role constraint.
BEGIN;

-- The role column uses a CHECK constraint, not a native ENUM.
-- Drop and recreate the constraint to include the new value.
DO $$
BEGIN
    -- Find and drop existing role check constraint
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'users'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%role%'
    ) THEN
        EXECUTE (
            SELECT 'ALTER TABLE users DROP CONSTRAINT ' || quote_ident(conname)
            FROM pg_constraint
            WHERE conrelid = 'users'::regclass
              AND contype = 'c'
              AND pg_get_constraintdef(oid) ILIKE '%role%'
            LIMIT 1
        );
    END IF;
END $$;

ALTER TABLE users
    ADD CONSTRAINT users_role_check
    CHECK (role IN ('user', 'qa_specialist', 'researcher', 'supervisor', 'moderator', 'group_admin', 'owner'));

COMMIT;
