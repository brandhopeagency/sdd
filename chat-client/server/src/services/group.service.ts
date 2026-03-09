import { query } from '../db';
import crypto from 'crypto';
import { logAuditEvent } from './auth.service';
import type {
  DbUser,
  GroupInvitationCode,
  GroupMembership,
  GroupRole,
  GroupMembershipStatus,
  PaginationParams,
  User
} from '../types';
import { dbUserToUser } from '../types';

export interface Group {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export async function updateGroup(
  groupId: string,
  input: { name: string },
  actorId: string,
  ipAddress?: string
): Promise<Group | null> {
  const name = input.name.trim();
  if (!name) {
    throw new Error('INVALID_GROUP_NAME');
  }
  const result = await query(
    `UPDATE groups
     SET name = $2
     WHERE id = $1
     RETURNING *`,
    [groupId, name]
  );
  if (result.rows.length === 0) return null;

  await logAuditEvent(actorId, 'group.update', 'group', groupId, { name }, ipAddress);
  return rowToGroup(result.rows[0]);
}

function normalizeInvitationCode(code: string): string {
  return code.trim().toUpperCase();
}

function isValidInvitationCode(code: string): boolean {
  return /^[A-Z0-9]+$/.test(code);
}

function rowToGroup(row: any): Group {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function rowToInvitationCode(row: any): GroupInvitationCode {
  const now = Date.now();
  const expiresAt = row.expires_at ? new Date(row.expires_at) : null;
  const revokedAt = row.revoked_at ? new Date(row.revoked_at) : null;
  const maxUses = Number(row.max_uses) || 0;
  const uses = Number(row.uses) || 0;
  const isExpired = !!(expiresAt && expiresAt.getTime() <= now);
  const isExhausted = maxUses > 0 && uses >= maxUses;
  const isActive = !revokedAt && !isExpired && !isExhausted;
  return {
    id: row.id,
    groupId: row.group_id,
    code: row.code,
    isActive,
    expiresAt,
    createdAt: row.created_at,
    updatedAt: revokedAt || row.created_at
  };
}

function rowToMembership(row: any): GroupMembership {
  return {
    userId: row.user_id,
    groupId: row.group_id,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    groupName: row.group_name ?? null
  };
}

export async function getGroupById(groupId: string): Promise<Group | null> {
  const result = await query(`SELECT * FROM groups WHERE id = $1`, [groupId]);
  if (result.rows.length === 0) return null;
  return rowToGroup(result.rows[0]);
}

export async function createGroup(
  input: { name: string },
  actorId: string,
  ipAddress?: string
): Promise<Group> {
  const name = input.name.trim();
  if (!name) {
    throw new Error('INVALID_GROUP_NAME');
  }

  const result = await query(
    `INSERT INTO groups (name) VALUES ($1) RETURNING *`,
    [name]
  );
  const group = rowToGroup(result.rows[0]);

  await logAuditEvent(actorId, 'group.create', 'group', group.id, { name }, ipAddress);
  return group;
}

export async function listGroups(): Promise<Group[]> {
  const result = await query(`SELECT * FROM groups ORDER BY name ASC`);
  return result.rows.map(rowToGroup);
}

export async function getGroupStats(groupId: string): Promise<{
  groupId: string;
  userCounts: { total: number; active: number; blocked: number; pending: number; anonymized: number };
  sessionCounts: {
    total: number;
    active: number;
    ended: number;
    expired: number;
    moderation: { pending: number; in_review: number; moderated: number };
  };
}> {
  const [userCounts, sessionCounts, moderationCounts] = await Promise.all([
    query(
      `
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE u.status = 'active')::int AS active,
          COUNT(*) FILTER (WHERE u.status = 'blocked')::int AS blocked,
          COUNT(*) FILTER (WHERE u.status = 'pending')::int AS pending,
          COUNT(*) FILTER (WHERE u.status = 'anonymized')::int AS anonymized
        FROM group_memberships gm
        JOIN users u ON u.id = gm.user_id
        WHERE gm.group_id = $1 AND gm.status = 'active'
      `,
      [groupId]
    ),
    query(
      `
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status = 'active')::int AS active,
          COUNT(*) FILTER (WHERE status = 'ended')::int AS ended,
          COUNT(*) FILTER (WHERE status = 'expired')::int AS expired
        FROM sessions
        WHERE group_id = $1
      `,
      [groupId]
    ),
    query(
      `
        SELECT
          COUNT(*) FILTER (WHERE moderation_status = 'pending')::int AS pending,
          COUNT(*) FILTER (WHERE moderation_status = 'in_review')::int AS in_review,
          COUNT(*) FILTER (WHERE moderation_status = 'moderated')::int AS moderated
        FROM sessions
        WHERE group_id = $1
      `,
      [groupId]
    )
  ]);

  return {
    groupId,
    userCounts: userCounts.rows[0],
    sessionCounts: {
      ...sessionCounts.rows[0],
      moderation: moderationCounts.rows[0]
    }
  };
}

export async function listGroupUsers(
  groupId: string,
  params: PaginationParams
): Promise<{
  users: User[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}> {
  const {
    page = 1,
    limit = 10,
    search = '',
    role = 'all',
    status = 'all',
    sortBy = 'created_at',
    sortOrder = 'desc'
  } = params;

  const offset = (page - 1) * limit;
  const conditions: string[] = ['gm.group_id = $1', `gm.status = 'active'`];
  const values: any[] = [groupId];
  let paramIndex = 2;

  if (search) {
    conditions.push(`(u.email ILIKE $${paramIndex} OR u.display_name ILIKE $${paramIndex})`);
    values.push(`%${search}%`);
    paramIndex++;
  }

  if (role && role !== 'all') {
    conditions.push(`u.role = $${paramIndex}`);
    values.push(role);
    paramIndex++;
  }

  if (status && status !== 'all') {
    conditions.push(`u.status = $${paramIndex}`);
    values.push(status);
    paramIndex++;
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const validSortColumns = ['created_at', 'updated_at', 'email', 'display_name', 'last_login_at', 'session_count'];
  const safeSortBy = validSortColumns.includes(sortBy) ? sortBy : 'created_at';
  const safeSortOrder = sortOrder === 'asc' ? 'ASC' : 'DESC';

  const countResult = await query(
    `SELECT COUNT(*) as total FROM group_memberships gm
     JOIN users u ON u.id = gm.user_id
     ${whereClause}`,
    values
  );
  const total = parseInt(countResult.rows[0]?.total || '0', 10);

  const usersResult = await query<DbUser>(
    `SELECT u.* FROM group_memberships gm
     JOIN users u ON u.id = gm.user_id
     ${whereClause}
     ORDER BY u.${safeSortBy} ${safeSortOrder}
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...values, limit, offset]
  );

  const users = usersResult.rows.map(dbUserToUser);

  return {
    users,
    total,
    page,
    limit,
    hasMore: offset + users.length < total
  };
}

export async function listGroupMemberships(
  groupId: string,
  params: PaginationParams
): Promise<{
  members: Array<User & { membershipRole: GroupRole; membershipStatus: GroupMembershipStatus }>;
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}> {
  const result = await listGroupUsers(groupId, params);
  const memberships = await query(
    `SELECT user_id, role, status FROM group_memberships WHERE group_id = $1`,
    [groupId]
  );
  const membershipMap = new Map(memberships.rows.map((row: any) => [row.user_id, row]));
  const members = result.users.map((user) => ({
    ...user,
    membershipRole: (membershipMap.get(user.id)?.role as GroupRole) || 'member',
    membershipStatus: (membershipMap.get(user.id)?.status as GroupMembershipStatus) || 'active'
  }));

  return {
    members,
    total: result.total,
    page: result.page,
    limit: result.limit,
    hasMore: result.hasMore
  };
}

export async function addUserToGroup(input: { groupId: string; userId: string }, actorId: string, ipAddress?: string) {
  const current = await query<Pick<DbUser, 'role' | 'group_id'>>(
    `SELECT role, group_id FROM users WHERE id = $1`,
    [input.userId]
  );
  if (current.rows.length === 0) return null;

  const role = current.rows[0].role as any;

  // Security boundary: group admins must not be able to move privileged accounts.
  if (['owner', 'moderator', 'researcher', 'group_admin'].includes(String(role))) {
    throw new Error('FORBIDDEN_TARGET_ROLE');
  }

  await query(
    `
      INSERT INTO group_memberships (user_id, group_id, role, status, requested_by, approved_by, approved_at, metadata)
      VALUES ($1, $2, 'member', 'active', $3, $3, NOW(), $4::jsonb)
      ON CONFLICT (group_id, user_id)
      DO UPDATE SET status = 'active', approved_by = $3, approved_at = NOW()
    `,
    [
      input.userId,
      input.groupId,
      actorId,
      JSON.stringify({
        source: 'manual',
        addedBy: actorId,
        addedAt: new Date().toISOString()
      })
    ]
  );

  const userResult = await query<DbUser>(`SELECT * FROM users WHERE id = $1`, [input.userId]);
  if (userResult.rows.length === 0) return null;
  const user = dbUserToUser(userResult.rows[0]);

  await logAuditEvent(
    actorId,
    'group.user_add',
    'group',
    input.groupId,
    { userId: input.userId },
    ipAddress
  );

  return user;
}

export async function findUserIdByEmail(email: string): Promise<string | null> {
  const normalizedEmail = email.toLowerCase().trim();
  const result = await query<{ id: string }>(`SELECT id FROM users WHERE email = $1`, [normalizedEmail]);
  return result.rows[0]?.id ?? null;
}

export async function removeUserFromGroup(
  input: { groupId: string; userId: string },
  actorId: string,
  ipAddress?: string
) {
  const membership = await query(
    `
      UPDATE group_memberships
      SET status = 'removed', approved_by = $3, approved_at = NOW()
      WHERE user_id = $1 AND group_id = $2 AND status <> 'removed'
    `,
    [input.userId, input.groupId, actorId]
  );
  if ((membership as any).rowCount === 0) return null;

  const updatedUser = await query<DbUser>(`SELECT * FROM users WHERE id = $1`, [input.userId]);
  if (updatedUser.rows.length === 0) return null;
  const user = dbUserToUser(updatedUser.rows[0]);

  await logAuditEvent(
    actorId,
    'group.user_remove',
    'group',
    input.groupId,
    { userId: input.userId },
    ipAddress
  );

  return user;
}

export async function listMembershipsForUser(userId: string): Promise<GroupMembership[]> {
  const result = await query(
    `SELECT gm.*, g.name as group_name
     FROM group_memberships gm
     JOIN groups g ON g.id = gm.group_id
     WHERE gm.user_id = $1
     ORDER BY g.name ASC`,
    [userId]
  );
  return result.rows.map(rowToMembership);
}

export async function getMembershipForUser(
  userId: string,
  groupId: string
): Promise<Pick<GroupMembership, 'role' | 'status'> | null> {
  const result = await query(
    `SELECT role, status FROM group_memberships WHERE user_id = $1 AND group_id = $2`,
    [userId, groupId]
  );
  if (result.rows.length === 0) return null;
  return {
    role: result.rows[0].role,
    status: result.rows[0].status
  };
}

export async function setGroupMembershipRole(
  input: { groupId: string; userId: string; role: GroupRole },
  actorId: string,
  ipAddress?: string
) {
  const result = await query(
    `UPDATE group_memberships
     SET role = $1
     WHERE user_id = $2 AND group_id = $3
     RETURNING user_id`,
    [input.role, input.userId, input.groupId]
  );
  if (result.rows.length === 0) return null;

  await logAuditEvent(
    actorId,
    'group.user_role',
    'group',
    input.groupId,
    { userId: input.userId, role: input.role },
    ipAddress
  );
  return true;
}

export async function listInvitationCodes(groupId: string): Promise<GroupInvitationCode[]> {
  const result = await query(
    `SELECT * FROM group_invite_codes WHERE group_id = $1 ORDER BY created_at DESC`,
    [groupId]
  );
  return result.rows.map(rowToInvitationCode);
}

export async function createInvitationCode(
  input: { groupId: string; code?: string; expiresAt?: string | null; maxUses?: number },
  actorId: string,
  ipAddress?: string
): Promise<GroupInvitationCode> {
  const raw = input.code?.trim();
  const code = raw && raw.length > 0 ? normalizeInvitationCode(raw) : normalizeInvitationCode(crypto.randomBytes(4).toString('hex'));

  if (!isValidInvitationCode(code)) {
    throw new Error('INVALID_INVITATION_CODE');
  }

  const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
  if (expiresAt && Number.isNaN(expiresAt.getTime())) {
    throw new Error('INVALID_EXPIRES_AT');
  }
  const maxUses = Math.max(1, Math.min(Number(input.maxUses ?? 1) || 1, 1000));

  const result = await query(
    `INSERT INTO group_invite_codes (group_id, code, created_by, expires_at, max_uses, uses, metadata)
     VALUES ($1, $2, $3, $4, $5, 0, $6::jsonb)
     RETURNING *`,
    [
      input.groupId,
      code,
      actorId,
      expiresAt,
      maxUses,
      JSON.stringify({
        source: 'admin',
        createdBy: actorId
      })
    ]
  );
  const invitation = rowToInvitationCode(result.rows[0]);

  await logAuditEvent(
    actorId,
    'group.invite_create',
    'group',
    input.groupId,
    { code: invitation.code, expiresAt: invitation.expiresAt, maxUses },
    ipAddress
  );
  return invitation;
}

export async function deactivateInvitationCode(
  input: { groupId: string; codeId: string },
  actorId: string,
  ipAddress?: string
) {
  const result = await query(
    `UPDATE group_invite_codes
     SET revoked_at = NOW()
     WHERE id = $1 AND group_id = $2 AND revoked_at IS NULL
     RETURNING *`,
    [input.codeId, input.groupId]
  );
  if (result.rows.length === 0) return null;
  const invitation = rowToInvitationCode(result.rows[0]);

  await logAuditEvent(
    actorId,
    'group.invite_deactivate',
    'group',
    input.groupId,
    { codeId: input.codeId },
    ipAddress
  );
  return invitation;
}

export async function findGroupByInvitationCode(code: string): Promise<{ groupId: string } | null> {
  const normalized = normalizeInvitationCode(code);
  const result = await query(
    `SELECT group_id
     FROM group_invite_codes
     WHERE code = $1
       AND revoked_at IS NULL
       AND (expires_at IS NULL OR expires_at > NOW())
       AND (uses < max_uses OR max_uses IS NULL)
     LIMIT 1`,
    [normalized]
  );
  if (result.rows.length === 0) return null;
  return { groupId: result.rows[0].group_id };
}

export async function setMembershipStatus(
  input: { userId: string; groupId: string; status: GroupMembershipStatus },
  actorId: string | null,
  ipAddress?: string
) {
  const result = await query(
    `UPDATE group_memberships
     SET status = $1
     WHERE user_id = $2 AND group_id = $3
     RETURNING user_id`,
    [input.status, input.userId, input.groupId]
  );
  if (result.rows.length === 0) return null;
  if (actorId) {
    await logAuditEvent(
      actorId,
      'group.membership_status',
      'group',
      input.groupId,
      { userId: input.userId, status: input.status },
      ipAddress
    );
  }
  return true;
}
