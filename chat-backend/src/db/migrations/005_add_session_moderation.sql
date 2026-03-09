-- ============================================
-- Session Moderation (statuses, tags, annotations)
-- ============================================

-- 1) Add moderation status to sessions
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS moderation_status VARCHAR(20) NOT NULL DEFAULT 'pending';

DO $$
BEGIN
  ALTER TABLE sessions
    ADD CONSTRAINT sessions_moderation_status_check
    CHECK (moderation_status IN ('pending', 'in_review', 'moderated'));
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_sessions_moderation_status ON sessions(moderation_status);

COMMENT ON COLUMN sessions.moderation_status IS 'Moderation status: pending, in_review, moderated';

-- 2) Tags catalog
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category VARCHAR(20) NOT NULL,
  color VARCHAR(20) NOT NULL DEFAULT '#3b82f6',
  description TEXT NOT NULL DEFAULT '',
  is_custom BOOLEAN NOT NULL DEFAULT FALSE,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT tags_category_check CHECK (category IN ('session', 'message')),
  CONSTRAINT tags_name_category_unique UNIQUE (name, category)
);

DROP TRIGGER IF EXISTS update_tags_updated_at ON tags;
CREATE TRIGGER update_tags_updated_at
  BEFORE UPDATE ON tags
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_tags_category ON tags(category);
CREATE INDEX IF NOT EXISTS idx_tags_usage_count ON tags(usage_count DESC);

COMMENT ON TABLE tags IS 'Tag definitions for moderation (session/message)';

-- 3) Session tags (many-to-many)
CREATE TABLE IF NOT EXISTS session_tags (
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  added_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (session_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_session_tags_session_id ON session_tags(session_id);
CREATE INDEX IF NOT EXISTS idx_session_tags_tag_id ON session_tags(tag_id);

COMMENT ON TABLE session_tags IS 'Tags applied to sessions';

-- 4) Annotations (session or message level)
CREATE TABLE IF NOT EXISTS annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  message_id UUID,
  author_id UUID REFERENCES users(id) ON DELETE SET NULL,
  quality_rating SMALLINT NOT NULL,
  golden_reference TEXT,
  notes TEXT NOT NULL DEFAULT '',
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT annotations_quality_rating_check CHECK (quality_rating BETWEEN 1 AND 5)
);

DROP TRIGGER IF EXISTS update_annotations_updated_at ON annotations;
CREATE TRIGGER update_annotations_updated_at
  BEFORE UPDATE ON annotations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_annotations_session_id ON annotations(session_id);
CREATE INDEX IF NOT EXISTS idx_annotations_message_id ON annotations(message_id);
CREATE INDEX IF NOT EXISTS idx_annotations_created_at ON annotations(created_at DESC);

COMMENT ON TABLE annotations IS 'Moderator annotations (session/message level) with golden references and notes';

