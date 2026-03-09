-- 015_add_tagging_system.sql
-- Adds tag definitions, user-tag assignments, session-tag assignments,
-- session exclusion records, and min message threshold configuration.
BEGIN;

-- 1. Tag definitions table (shared namespace)
CREATE TABLE IF NOT EXISTS tag_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    name_lower VARCHAR(100) NOT NULL GENERATED ALWAYS AS (LOWER(name)) STORED,
    description TEXT,
    category VARCHAR(10) NOT NULL CHECK (category IN ('user', 'chat')),
    exclude_from_reviews BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tag_definitions_name_lower
    ON tag_definitions(name_lower);
CREATE INDEX IF NOT EXISTS idx_tag_definitions_category
    ON tag_definitions(category);
CREATE INDEX IF NOT EXISTS idx_tag_definitions_active
    ON tag_definitions(is_active) WHERE is_active = true;

-- 2. User-tag assignments
CREATE TABLE IF NOT EXISTS user_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tag_definition_id UUID NOT NULL REFERENCES tag_definitions(id) ON DELETE CASCADE,
    assigned_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_tags_user_tag
    ON user_tags(user_id, tag_definition_id);
CREATE INDEX IF NOT EXISTS idx_user_tags_user
    ON user_tags(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tags_tag
    ON user_tags(tag_definition_id);

-- 3. Session-tag assignments
CREATE TABLE IF NOT EXISTS session_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    tag_definition_id UUID NOT NULL REFERENCES tag_definitions(id) ON DELETE CASCADE,
    source VARCHAR(10) NOT NULL CHECK (source IN ('system', 'manual')),
    applied_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Compatibility path for environments that already had legacy moderation tags
-- from migration 005 (session_tags.tag_id -> tags.id, plus added_by column).
-- This block is idempotent and safely upgrades the shape expected by current services.
DO $$
BEGIN
    IF to_regclass('public.tags') IS NOT NULL THEN
        INSERT INTO tag_definitions (name, description, category, exclude_from_reviews, is_active)
        SELECT
            t.name,
            NULLIF(t.description, ''),
            'chat',
            false,
            true
        FROM tags t
        ON CONFLICT (name_lower) DO NOTHING;
    END IF;

    IF to_regclass('public.session_tags') IS NOT NULL THEN
        -- Add new FK column when migrating from legacy schema.
        IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'session_tags' AND column_name = 'tag_id'
        ) AND NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'session_tags' AND column_name = 'tag_definition_id'
        ) THEN
            ALTER TABLE session_tags ADD COLUMN tag_definition_id UUID;
        END IF;

        -- Backfill tag_definition_id from legacy tags mapping by normalized name.
        IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'session_tags' AND column_name = 'tag_definition_id'
        ) AND EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'session_tags' AND column_name = 'tag_id'
        ) AND to_regclass('public.tags') IS NOT NULL THEN
            UPDATE session_tags st
            SET tag_definition_id = td.id
            FROM tags t
            JOIN tag_definitions td ON td.name_lower = LOWER(t.name)
            WHERE st.tag_id = t.id
              AND st.tag_definition_id IS NULL;
        END IF;

        -- Legacy column rename.
        IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'session_tags' AND column_name = 'added_by'
        ) AND NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'session_tags' AND column_name = 'applied_by'
        ) THEN
            ALTER TABLE session_tags RENAME COLUMN added_by TO applied_by;
        END IF;

        -- Ensure newer columns exist.
        IF NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'session_tags' AND column_name = 'applied_by'
        ) THEN
            ALTER TABLE session_tags ADD COLUMN applied_by UUID REFERENCES users(id);
        END IF;

        IF NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'session_tags' AND column_name = 'source'
        ) THEN
            ALTER TABLE session_tags ADD COLUMN source VARCHAR(10) NOT NULL DEFAULT 'manual';
        END IF;

        -- Keep source values compatible with current check constraint.
        UPDATE session_tags
        SET source = 'manual'
        WHERE source IS NULL OR source NOT IN ('system', 'manual');

        -- Add surrogate id where legacy composite PK exists.
        IF NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'session_tags' AND column_name = 'id'
        ) THEN
            ALTER TABLE session_tags ADD COLUMN id UUID DEFAULT gen_random_uuid();
        END IF;

        UPDATE session_tags
        SET id = gen_random_uuid()
        WHERE id IS NULL;

        -- If no unresolved legacy mappings remain, enforce NOT NULL.
        IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'session_tags' AND column_name = 'tag_definition_id'
        ) AND NOT EXISTS (
            SELECT 1 FROM session_tags WHERE tag_definition_id IS NULL
        ) THEN
            ALTER TABLE session_tags ALTER COLUMN tag_definition_id SET NOT NULL;
        END IF;

        -- Ensure FK exists for tag_definition_id.
        IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'session_tags' AND column_name = 'tag_definition_id'
        ) AND NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conrelid = 'session_tags'::regclass
              AND conname = 'session_tags_tag_definition_id_fkey'
        ) THEN
            ALTER TABLE session_tags
                ADD CONSTRAINT session_tags_tag_definition_id_fkey
                FOREIGN KEY (tag_definition_id) REFERENCES tag_definitions(id) ON DELETE CASCADE;
        END IF;
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_session_tags_session_tag
    ON session_tags(session_id, tag_definition_id);
CREATE INDEX IF NOT EXISTS idx_session_tags_session
    ON session_tags(session_id);
CREATE INDEX IF NOT EXISTS idx_session_tags_tag
    ON session_tags(tag_definition_id);

-- 4. Session exclusion records
CREATE TABLE IF NOT EXISTS session_exclusions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    reason VARCHAR(100) NOT NULL,
    reason_source VARCHAR(10) NOT NULL CHECK (reason_source IN ('user_tag', 'chat_tag')),
    tag_definition_id UUID REFERENCES tag_definitions(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_exclusions_session
    ON session_exclusions(session_id);

-- 5. Extend review_configuration with min message threshold
ALTER TABLE review_configuration
    ADD COLUMN IF NOT EXISTS min_message_threshold SMALLINT NOT NULL DEFAULT 4;

-- 6. Seed predefined tags
INSERT INTO tag_definitions (name, description, category, exclude_from_reviews, is_active)
VALUES
    ('functional QA', 'Tag for test/QA user accounts whose sessions should be excluded from the review queue', 'user', true, true),
    ('short', 'Auto-applied to chat sessions with fewer messages than the configured minimum threshold', 'chat', true, true)
ON CONFLICT (name_lower) DO NOTHING;

COMMIT;
