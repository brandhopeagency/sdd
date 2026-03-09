-- ============================================
-- Post-Migration Cleanup: Remove PostgreSQL refresh_tokens
-- ============================================
-- Execute this ONLY after 7 days post-deployment of Redis token persistence.
-- By that time, all existing PostgreSQL-based refresh tokens will have
-- expired naturally (7-day TTL), and all active tokens are in Redis.
--
-- Jira: MTB-374
-- Feature: 014-redis-token-persistence
-- ============================================

-- Drop the periodic cleanup function (no longer needed; Redis handles TTL)
DROP FUNCTION IF EXISTS cleanup_expired_refresh_tokens();

-- Drop the table (CASCADE handles foreign key constraints)
DROP TABLE IF EXISTS refresh_tokens CASCADE;

-- The associated indexes (idx_refresh_user, idx_refresh_expires) are
-- dropped automatically when the table is dropped.
