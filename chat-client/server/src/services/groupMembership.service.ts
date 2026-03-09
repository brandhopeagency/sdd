import crypto from 'crypto';
import { query, transaction } from '../db';
import { logAuditEvent } from './auth.service';

export type GroupMembershipRole = 'member' | 'admin';
export type GroupMembershipStatus = 'active' | 'pending' | 'rejected' | 'removed';

export interface UserGroupMembershipSummary {
  groupId: string;
  groupName: string;
  role: GroupMembershipRole;
  status: GroupMembershipStatus;
}

export interface PendingGroupRequest {
  userId: string;
  email: string;
  displayName: string;
  requestedAt: Date;
  source: 'invite' | 'manual' | 'unknown';
}

function normalizeInviteCode(input: string): string {
  return input.trim();
}

function generateHumanInviteCode(): string {
  // 12 chars, URL-safe-ish, avoids ambiguous chars.
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(12);
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

export async function listUserGroupMemberships(userId: string): Promise<UserGroupMembershipSummary[]> {
  const result = await query<{
    group_id: string;
    group_name: string;
    role: GroupMembershipRole;
    status: GroupMembershipStatus;
  }>(
    `
    SELECT
      gm.group_id,
      g.name AS group_name,
      gm.role,
      gm.status
    FROM group_memberships gm
    JOIN groups g ON g.id = gm.group_id
    WHERE gm.user_id = $1
      AND gm.status IN ('active', 'pending')
      AND g.archived_at IS NULL
    ORDER BY g.name ASC
    `,
    [userId]
  );

  return result.rows.map((r) => ({
    groupId: r.group_id,
    groupName: r.group_name,
    role: r.role,
    status: r.status
  }));
}

export async function getUserActiveGroupId(userId: string): Promise<string | null> {
  const user = await query<{ active_group_id: string | null }>(`SELECT active_group_id FROM users WHERE id = $1`, [
    userId
  ]);
  return user.rows[0]?.active_group_id ?? null;
}

export async function resolveUserGroupContext(userId: string): Promise<{
  activeGroupId: string | null;
  groupRole: GroupMembershipRole | null;
  memberships: UserGroupMembershipSummary[];
}> {
  const [activeGroupId, memberships] = await Promise.all([getUserActiveGroupId(userId), listUserGroupMemberships(userId)]);

  // If no active group, pick first active membership (do not auto-write to DB here).
  const effectiveGroupId =
    activeGroupId && memberships.some((m) => m.groupId === activeGroupId && m.status === 'active')
      ? activeGroupId
      : memberships.find((m) => m.status === 'active')?.groupId ?? null;

  const groupRole =
    effectiveGroupId ? memberships.find((m) => m.groupId === effectiveGroupId && m.status === 'active')?.role ?? null : null;

  return { activeGroupId: effectiveGroupId, groupRole, memberships };
}

export async function setActiveGroup(
  userId: string,
  groupId: string,
  actorId: string,
  options?: { allowWithoutMembership?: boolean; ipAddress?: string }
): Promise<{ activeGroupId: string }> {
  const allowWithoutMembership = options?.allowWithoutMembership ?? false;

  if (!allowWithoutMembership) {
    // Only allow switching to ACTIVE membership in a non-archived group.
    const membership = await query<{ status: GroupMembershipStatus }>(
      `
        SELECT gm.status
        FROM group_memberships gm
        JOIN groups g ON g.id = gm.group_id
        WHERE gm.user_id = $1 AND gm.group_id = $2 AND g.archived_at IS NULL
      `,
      [userId, groupId]
    );
    if (membership.rows[0]?.status !== 'active') {
      throw new Error('NO_ACTIVE_MEMBERSHIP');
    }
  } else {
    const groupResult = await query<{ id: string }>(
      `SELECT id FROM groups WHERE id = $1 AND archived_at IS NULL`,
      [groupId]
    );
    if (groupResult.rows.length === 0) {
      throw new Error('NO_ACTIVE_MEMBERSHIP');
    }
  }

  await query(`UPDATE users SET active_group_id = $1 WHERE id = $2`, [groupId, userId]);
  await logAuditEvent(actorId, 'group.active_set', 'group', groupId, { userId }, options?.ipAddress);
  return { activeGroupId: groupId };
}

export async function createInviteCode(
  input: { groupId: string; maxUses?: number; expiresAt?: string | null },
  actorId: string,
  ipAddress?: string
): Promise<{ code: string; groupId: string; maxUses: number; expiresAt: Date | null }> {
  const maxUses = Math.max(1, Math.min(Number(input.maxUses ?? 1) || 1, 1000));
  const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
  if (expiresAt && Number.isNaN(expiresAt.getTime())) {
    throw new Error('INVALID_EXPIRES_AT');
  }

  // Best-effort uniqueness loop.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateHumanInviteCode();
    try {
      await query(
        `
          INSERT INTO group_invite_codes (group_id, code, created_by, max_uses, expires_at)
          VALUES ($1, $2, $3, $4, $5)
        `,
        [input.groupId, code, actorId, maxUses, expiresAt]
      );

      await logAuditEvent(actorId, 'group.invite_create', 'group', input.groupId, { code, maxUses, expiresAt }, ipAddress);
      return { code, groupId: input.groupId, maxUses, expiresAt };
    } catch (e: any) {
      // Unique violation -> retry
      if (String(e?.code) === '23505') continue;
      throw e;
    }
  }

  throw new Error('INVITE_CODE_GENERATION_FAILED');
}

export async function requestMembershipWithInviteCode(
  input: { userId: string; code: string },
  ipAddress?: string
): Promise<{ groupId: string; status: GroupMembershipStatus }> {
  const code = normalizeInviteCode(input.code);
  if (!code) throw new Error('INVALID_INVITE_CODE');

  return transaction(async (client) => {
    // Lock invite row to safely increment uses
    const invite = await client.query<{
      id: string;
      group_id: string;
      revoked_at: Date | null;
      expires_at: Date | null;
      max_uses: number;
      uses: number;
    }>(
      `
      SELECT id, group_id, revoked_at, expires_at, max_uses, uses
      FROM group_invite_codes
      WHERE code = $1
      FOR UPDATE
      `,
      [code]
    );

    if (invite.rows.length === 0) throw new Error('INVITE_NOT_FOUND');
    const row = invite.rows[0];
    if (row.revoked_at) throw new Error('INVITE_REVOKED');
    if (row.expires_at && row.expires_at.getTime() <= Date.now()) throw new Error('INVITE_EXPIRED');
    if (row.uses >= row.max_uses) throw new Error('INVITE_MAX_USES');

    // Ensure group is not archived
    const groupOk = await client.query<{ ok: boolean }>(
      `SELECT TRUE as ok FROM groups WHERE id = $1 AND archived_at IS NULL`,
      [row.group_id]
    );
    if (groupOk.rows.length === 0) throw new Error('GROUP_ARCHIVED');

    // Upsert-ish membership: if already exists, just return current status.
    const existing = await client.query<{ status: GroupMembershipStatus }>(
      `SELECT status FROM group_memberships WHERE user_id = $1 AND group_id = $2`,
      [input.userId, row.group_id]
    );
    if (existing.rows.length > 0) {
      return { groupId: row.group_id, status: existing.rows[0].status };
    }

    await client.query(
      `
      INSERT INTO group_memberships (user_id, group_id, role, status, requested_by, metadata)
      VALUES ($1, $2, 'member', 'pending', $1, $3::jsonb)
      `,
      [
        input.userId,
        row.group_id,
        JSON.stringify({
          source: 'invite',
          inviteCodeId: row.id,
          ipAddress: ipAddress ?? null,
          requestedAt: new Date().toISOString()
        })
      ]
    );

    return { groupId: row.group_id, status: 'pending' };
  });
}

export async function listPendingGroupRequests(groupId: string): Promise<PendingGroupRequest[]> {
  const result = await query<{
    user_id: string;
    email: string;
    display_name: string;
    created_at: Date;
    metadata: any;
  }>(
    `
    SELECT gm.user_id, u.email, u.display_name, gm.created_at, gm.metadata
    FROM group_memberships gm
    JOIN users u ON u.id = gm.user_id
    WHERE gm.group_id = $1 AND gm.status = 'pending'
    ORDER BY gm.created_at ASC
    `,
    [groupId]
  );

  return result.rows.map((r) => ({
    userId: r.user_id,
    email: r.email,
    displayName: r.display_name,
    requestedAt: r.created_at,
    source: (r.metadata?.source === 'invite' ? 'invite' : r.metadata?.source === 'manual' ? 'manual' : 'unknown') as any
  }));
}

export async function approveGroupRequest(
  input: { groupId: string; userId: string },
  actorId: string,
  ipAddress?: string
): Promise<{ ok: true }> {
  return transaction(async (client) => {
    const pending = await client.query<{ metadata: any }>(
      `
      SELECT metadata
      FROM group_memberships
      WHERE group_id = $1 AND user_id = $2 AND status = 'pending'
      FOR UPDATE
      `,
      [input.groupId, input.userId]
    );
    if (pending.rows.length === 0) throw new Error('REQUEST_NOT_FOUND');

    const metadata = pending.rows[0]?.metadata || {};
    const source = metadata?.source;
    const inviteCodeId = metadata?.inviteCodeId;

    // Claim invite usage at approval time (not request time) to avoid burning invites on unapproved requests.
    if (source === 'invite' && typeof inviteCodeId === 'string' && inviteCodeId) {
      const claimed = await client.query(
        `
        UPDATE group_invite_codes
        SET uses = uses + 1
        WHERE id = $1
          AND revoked_at IS NULL
          AND (expires_at IS NULL OR expires_at > NOW())
          AND uses < max_uses
        RETURNING id
        `,
        [inviteCodeId]
      );
      if (claimed.rows.length === 0) throw new Error('INVITE_NOT_AVAILABLE');
    }

    const updated = await client.query(
      `
      UPDATE group_memberships
      SET status = 'active', approved_by = $3, approved_at = NOW()
      WHERE group_id = $1 AND user_id = $2 AND status = 'pending'
      `,
      [input.groupId, input.userId, actorId]
    );
    if ((updated as any).rowCount === 0) throw new Error('REQUEST_NOT_FOUND');

    if (source === 'invite') {
      // If this user was pending solely due to invite flow, activating membership activates the user.
      await client.query(`UPDATE users SET status = 'active' WHERE id = $1 AND status = 'pending'`, [input.userId]);
    }

    await logAuditEvent(actorId, 'group.request_approve', 'group', input.groupId, { userId: input.userId }, ipAddress);
    return { ok: true };
  });
}

export async function rejectGroupRequest(
  input: { groupId: string; userId: string },
  actorId: string,
  ipAddress?: string
): Promise<{ ok: true }> {
  const result = await query(
    `
      UPDATE group_memberships
      SET status = 'rejected', approved_by = $3, approved_at = NOW()
      WHERE group_id = $1 AND user_id = $2 AND status = 'pending'
    `,
    [input.groupId, input.userId, actorId]
  );
  if ((result as any).rowCount === 0) throw new Error('REQUEST_NOT_FOUND');
  await logAuditEvent(actorId, 'group.request_reject', 'group', input.groupId, { userId: input.userId }, ipAddress);
  return { ok: true };
}

export async function setGroupMembershipRole(
  input: { groupId: string; userId: string; role: GroupMembershipRole },
  actorId: string,
  ipAddress?: string
): Promise<{ ok: true }> {
  await query(
    `
      INSERT INTO group_memberships (user_id, group_id, role, status, requested_by, approved_by, approved_at, metadata)
      VALUES ($1, $2, $3, 'active', $4, $4, NOW(), $5::jsonb)
      ON CONFLICT (group_id, user_id)
      DO UPDATE SET role = EXCLUDED.role, status = 'active', approved_by = $4, approved_at = NOW()
    `,
    [
      input.userId,
      input.groupId,
      input.role,
      actorId,
      JSON.stringify({ source: 'manual', updatedBy: actorId, updatedAt: new Date().toISOString() })
    ]
  );

  // Best-effort: set active group context if empty
  await query(`UPDATE users SET active_group_id = COALESCE(active_group_id, $1) WHERE id = $2`, [
    input.groupId,
    input.userId
  ]);

  await logAuditEvent(actorId, 'group.membership_role_set', 'group', input.groupId, { userId: input.userId, role: input.role }, ipAddress);
  return { ok: true };
}

