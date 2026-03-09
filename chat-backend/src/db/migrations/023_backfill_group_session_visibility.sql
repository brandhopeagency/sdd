-- ============================================
-- Backfill: group session visibility
-- ============================================
-- Fixes users and sessions that were affected by addUserToGroup(),
-- createAndAddUserToGroup(), and approveGroupRequest() not setting
-- users.active_group_id when creating/activating group memberships.

-- Step 1: Set active_group_id for users who have active memberships
-- but NULL active_group_id and NULL group_id.
-- Uses the earliest approved membership to pick a deterministic group.
UPDATE users u
SET active_group_id = (
  SELECT gm.group_id
  FROM group_memberships gm
  WHERE gm.user_id = u.id AND gm.status = 'active'
  ORDER BY gm.approved_at ASC NULLS LAST
  LIMIT 1
)
WHERE u.active_group_id IS NULL
  AND u.group_id IS NULL
  AND EXISTS (
    SELECT 1 FROM group_memberships gm
    WHERE gm.user_id = u.id AND gm.status = 'active'
  );

-- Step 2: Backfill sessions.group_id using group_memberships
-- for sessions where group_id is NULL but user has an active membership.
UPDATE sessions s
SET group_id = (
  SELECT gm.group_id
  FROM group_memberships gm
  WHERE gm.user_id = s.user_id AND gm.status = 'active'
  ORDER BY gm.approved_at ASC NULLS LAST
  LIMIT 1
)
WHERE s.group_id IS NULL
  AND s.user_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM group_memberships gm
    WHERE gm.user_id = s.user_id AND gm.status = 'active'
  );
