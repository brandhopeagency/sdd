import { query, transaction } from '../db';
import { logAuditEvent } from './auth.service';
import { 
  DbUser, 
  User, 
  UserRole, 
  UserStatus,
  PaginationParams,
  dbUserToUser 
} from '../types';

const TEST_USER_TAG_NAME = 'functional QA';

/**
 * Get paginated list of users with filtering
 */
export function getUsers(params: PaginationParams): Promise<{
  users: User[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}>;

export function getUsers(
  params: PaginationParams,
  options: { includePiiSearch?: boolean; includePiiSort?: boolean }
): Promise<{
  users: User[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}>;

export async function getUsers(
  params: PaginationParams,
  options?: { includePiiSearch?: boolean; includePiiSort?: boolean }
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
    sortOrder = 'desc',
    tags,
    testUsersOnly = false,
  } = params;

  const offset = (page - 1) * limit;
  const conditions: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;
  const includePiiSearch = options?.includePiiSearch ?? true;
  const includePiiSort = options?.includePiiSort ?? true;

  // Search filter
  if (search) {
    if (includePiiSearch) {
      conditions.push(`(email ILIKE $${paramIndex} OR display_name ILIKE $${paramIndex})`);
    } else {
      conditions.push(`(id::text ILIKE $${paramIndex})`);
    }
    values.push(`%${search}%`);
    paramIndex++;
  }

  // Role filter
  if (role && role !== 'all') {
    conditions.push(`role = $${paramIndex}`);
    values.push(role);
    paramIndex++;
  }

  // Status filter
  if (status && status !== 'all') {
    conditions.push(`status = $${paramIndex}`);
    values.push(status);
    paramIndex++;
  }

  // Tags filter: comma-separated tag names, users must have ALL specified tags
  if (tags) {
    const tagNames = tags.split(',').map((t) => t.trim()).filter(Boolean);
    if (tagNames.length > 0) {
      conditions.push(
        `EXISTS (
          SELECT 1 FROM user_tags ut
          JOIN tag_definitions td ON td.id = ut.tag_definition_id
          WHERE ut.user_id = users.id
            AND td.name = ANY($${paramIndex}::text[])
        )`,
      );
      values.push(tagNames);
      paramIndex++;
    }
  }

  // Test users filter: users tagged with "functional QA"
  if (testUsersOnly) {
    conditions.push(
      `EXISTS (
        SELECT 1 FROM user_tags ut
        JOIN tag_definitions td ON td.id = ut.tag_definition_id
        WHERE ut.user_id = users.id
          AND LOWER(td.name) = LOWER($${paramIndex})
      )`,
    );
    values.push(TEST_USER_TAG_NAME);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  
  // Validate sort column to prevent SQL injection
  const validSortColumns = includePiiSort
    ? ['created_at', 'updated_at', 'email', 'display_name', 'last_login_at', 'session_count']
    : ['created_at', 'updated_at', 'last_login_at', 'session_count'];
  const safeSortBy = validSortColumns.includes(sortBy) ? sortBy : 'created_at';
  const safeSortOrder = sortOrder === 'asc' ? 'ASC' : 'DESC';

  // Get total count
  const countResult = await query(
    `SELECT COUNT(*) as total FROM users ${whereClause}`,
    values
  );
  const total = parseInt(countResult.rows[0]?.total || '0');

  // Get paginated results
  const usersResult = await query<DbUser>(
    `SELECT
       users.*,
       EXISTS (
         SELECT 1
         FROM user_tags ut
         JOIN tag_definitions td ON td.id = ut.tag_definition_id
         WHERE ut.user_id = users.id
           AND LOWER(td.name) = LOWER($${paramIndex})
       ) AS is_test_user
     FROM users
     ${whereClause}
     ORDER BY ${safeSortBy} ${safeSortOrder}
     LIMIT $${paramIndex + 1} OFFSET $${paramIndex + 2}`,
    [...values, TEST_USER_TAG_NAME, limit, offset]
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

/**
 * Get user by ID
 */
export async function getUserById(userId: string): Promise<User | null> {
  const result = await query<DbUser>(
    'SELECT * FROM users WHERE id = $1',
    [userId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return dbUserToUser(result.rows[0]);
}

/**
 * Get user by email
 */
export async function getUserByEmail(email: string): Promise<User | null> {
  const result = await query<DbUser>(
    'SELECT * FROM users WHERE email = $1',
    [email.toLowerCase().trim()]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return dbUserToUser(result.rows[0]);
}

/**
 * Create a new user
 */
export async function createUser(
  userData: {
    email: string;
    displayName: string;
    role?: UserRole;
    status?: UserStatus;
  },
  actorId: string,
  ipAddress?: string
): Promise<User> {
  const normalizedEmail = userData.email.toLowerCase().trim();
  
  // Check if user already exists
  const existingUser = await getUserByEmail(normalizedEmail);
  if (existingUser) {
    throw new Error('EMAIL_ALREADY_EXISTS');
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalizedEmail)) {
    throw new Error('INVALID_EMAIL_FORMAT');
  }

  // Set defaults
  const role = userData.role || UserRole.USER;
  const status = userData.status || 'active';

  // Create user
  const result = await query<DbUser>(
    `INSERT INTO users (email, display_name, role, status, session_count)
     VALUES ($1, $2, $3, $4, 0)
     RETURNING *`,
    [normalizedEmail, userData.displayName, role, status]
  );

  const newUser = dbUserToUser(result.rows[0]);

  // Log audit event
  await logAuditEvent(
    actorId,
    'user.create',
    'user',
    newUser.id,
    { email: normalizedEmail, displayName: userData.displayName, role, status },
    ipAddress
  );

  return newUser;
}

/**
 * Update user
 */
export async function updateUser(
  userId: string,
  updates: {
    displayName?: string;
    role?: UserRole;
    status?: UserStatus;
    groupId?: string | null;
  },
  actorId: string,
  ipAddress?: string
): Promise<User | null> {
  const setClauses: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (updates.displayName !== undefined) {
    setClauses.push(`display_name = $${paramIndex}`);
    values.push(updates.displayName);
    paramIndex++;
  }

  if (updates.role !== undefined) {
    setClauses.push(`role = $${paramIndex}`);
    values.push(updates.role);
    paramIndex++;
  }

  if (updates.status !== undefined) {
    setClauses.push(`status = $${paramIndex}`);
    values.push(updates.status);
    paramIndex++;
  }

  if (updates.groupId !== undefined) {
    setClauses.push(`group_id = $${paramIndex}`);
    values.push(updates.groupId);
    paramIndex++;
  }

  if (setClauses.length === 0) {
    return getUserById(userId);
  }

  values.push(userId);

  const result = await query<DbUser>(
    `UPDATE users SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );

  if (result.rows.length === 0) {
    return null;
  }

  // Log audit event
  await logAuditEvent(
    actorId,
    'user.update',
    'user',
    userId,
    { updates },
    ipAddress
  );

  return dbUserToUser(result.rows[0]);
}

/**
 * Block a user
 */
export async function blockUser(
  userId: string,
  reason: string,
  actorId: string,
  ipAddress?: string
): Promise<User | null> {
  const result = await query<DbUser>(
    `UPDATE users 
     SET status = 'blocked', 
         metadata = metadata || $1::jsonb
     WHERE id = $2 
     RETURNING *`,
    [JSON.stringify({ blockReason: reason, blockedAt: new Date().toISOString() }), userId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  // Invalidate all refresh tokens for blocked user
  await query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);

  // Log audit event
  await logAuditEvent(
    actorId,
    'user.block',
    'user',
    userId,
    { reason },
    ipAddress
  );

  return dbUserToUser(result.rows[0]);
}

/**
 * Unblock a user
 */
export async function unblockUser(
  userId: string,
  actorId: string,
  ipAddress?: string
): Promise<User | null> {
  const result = await query<DbUser>(
    `UPDATE users 
     SET status = 'active',
         metadata = metadata - 'blockReason' - 'blockedAt'
     WHERE id = $1 
     RETURNING *`,
    [userId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  // Log audit event
  await logAuditEvent(
    actorId,
    'user.unblock',
    'user',
    userId,
    {},
    ipAddress
  );

  return dbUserToUser(result.rows[0]);
}

export async function markUserApproved(
  userId: string,
  actorId: string,
  comment?: string,
  ipAddress?: string
): Promise<User | null> {
  const result = await query<DbUser>(
    `UPDATE users
     SET status = 'active',
         approved_by = $1,
         approved_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [actorId, userId]
  );

  if (result.rows.length === 0) return null;

  await logAuditEvent(
    actorId,
    'user.approve',
    'user',
    userId,
    comment ? { comment } : {},
    ipAddress
  );

  return dbUserToUser(result.rows[0]);
}

export async function markUserDisapproved(
  userId: string,
  comment: string,
  actorId: string,
  ipAddress?: string
): Promise<User | null> {
  const result = await query<DbUser>(
    `UPDATE users
     SET status = 'disapproved',
         disapproved_at = NOW(),
         disapproval_comment = $1,
         disapproval_count = COALESCE(disapproval_count, 0) + 1
     WHERE id = $2
     RETURNING *`,
    [comment, userId]
  );

  if (result.rows.length === 0) return null;

  // Invalidate refresh tokens for disapproved user
  await query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);

  await logAuditEvent(
    actorId,
    'user.disapprove',
    'user',
    userId,
    { comment },
    ipAddress
  );

  return dbUserToUser(result.rows[0]);
}

export async function markUserForApproval(userId: string): Promise<User | null> {
  const result = await query<DbUser>(
    `UPDATE users
     SET status = 'approval'
     WHERE id = $1
     RETURNING *`,
    [userId]
  );
  if (result.rows.length === 0) return null;
  return dbUserToUser(result.rows[0]);
}

/**
 * Approve a pending user (activate account)
 */
export async function approveUser(
  userId: string,
  actorId: string,
  ipAddress?: string
): Promise<User | null> {
  const result = await query<DbUser>(
    `UPDATE users
     SET status = 'active',
         metadata = metadata - 'pendingReason'
     WHERE id = $1 AND status = 'pending'
     RETURNING *`,
    [userId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  await logAuditEvent(actorId, 'user.approve', 'user', userId, {}, ipAddress);
  return dbUserToUser(result.rows[0]);
}

/**
 * Change user role
 */
export async function changeUserRole(
  userId: string,
  newRole: UserRole,
  actorId: string,
  ipAddress?: string
): Promise<User | null> {
  // Get current user to log the change
  const currentUser = await getUserById(userId);
  if (!currentUser) {
    return null;
  }

  const result = await query<DbUser>(
    'UPDATE users SET role = $1 WHERE id = $2 RETURNING *',
    [newRole, userId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  // Log audit event
  await logAuditEvent(
    actorId,
    'user.role_change',
    'user',
    userId,
    { previousRole: currentUser.role, newRole },
    ipAddress
  );

  return dbUserToUser(result.rows[0]);
}

/**
 * Request data export for a user (GDPR)
 */
export async function requestDataExport(
  userId: string,
  actorId: string,
  ipAddress?: string
): Promise<{ jobId: string; estimatedMinutes: number }> {
  // Generate a job ID
  const jobId = `export_${userId}_${Date.now()}`;
  
  // In a real implementation, this would queue a background job
  // For now, we just log the request
  await logAuditEvent(
    actorId,
    'user.export_request',
    'user',
    userId,
    { jobId },
    ipAddress
  );

  // TODO: Implement actual export functionality
  // This would involve:
  // 1. Querying all user data from various tables
  // 2. Packaging into a downloadable format (JSON/ZIP)
  // 3. Storing temporarily and generating a download URL

  return {
    jobId,
    estimatedMinutes: 5
  };
}

/**
 * Execute GDPR erasure for a user
 * This anonymizes all user data while preserving aggregate statistics
 */
export async function eraseUserData(
  userId: string,
  reason: string,
  actorId: string,
  ipAddress?: string
): Promise<User | null> {
  return transaction(async (client) => {
    // Get current user data for audit log
    const currentResult = await client.query<DbUser>(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );

    if (currentResult.rows.length === 0) {
      return null;
    }

    const currentUser = currentResult.rows[0];

    // Anonymize user data
    const anonymizedEmail = `anonymized_${userId}@deleted.local`;
    const anonymizedName = '[Anonymized User]';
    
    const result = await client.query<DbUser>(
      `UPDATE users 
       SET email = $1,
           display_name = $2,
           status = 'anonymized',
           metadata = $3::jsonb
       WHERE id = $4
       RETURNING *`,
      [
        anonymizedEmail,
        anonymizedName,
        JSON.stringify({
          erasedAt: new Date().toISOString(),
          erasureReason: reason,
          originalEmailHash: Buffer.from(currentUser.email).toString('base64')
        }),
        userId
      ]
    );

    // Delete all refresh tokens
    await client.query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);

    // Log audit event (with original email masked for audit purposes)
    await client.query(
      `INSERT INTO audit_log (actor_id, action, target_type, target_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        actorId,
        'user.erase',
        'user',
        userId,
        JSON.stringify({
          reason,
          originalEmailDomain: currentUser.email.split('@')[1]
        }),
        ipAddress
      ]
    );

    return result.rows.length > 0 ? dbUserToUser(result.rows[0]) : null;
  });
}

/**
 * Get user statistics
 */
export async function getUserStats(): Promise<{
  total: number;
  byStatus: Record<UserStatus, number>;
  byRole: Record<UserRole, number>;
}> {
  const [totalResult, statusResult, roleResult] = await Promise.all([
    query('SELECT COUNT(*) as count FROM users'),
    query(`SELECT status, COUNT(*) as count FROM users GROUP BY status`),
    query(`SELECT role, COUNT(*) as count FROM users GROUP BY role`)
  ]);

  const byStatus: Record<string, number> = {
    active: 0,
    blocked: 0,
    pending: 0,
    approval: 0,
    disapproved: 0,
    anonymized: 0
  };

  const byRole: Record<string, number> = {
    user: 0,
    qa_specialist: 0,
    researcher: 0,
    moderator: 0,
    group_admin: 0,
    owner: 0
  };

  for (const row of statusResult.rows) {
    byStatus[row.status] = parseInt(row.count);
  }

  for (const row of roleResult.rows) {
    byRole[row.role] = parseInt(row.count);
  }

  return {
    total: parseInt(totalResult.rows[0]?.count || '0'),
    byStatus: byStatus as Record<UserStatus, number>,
    byRole: byRole as Record<UserRole, number>
  };
}

export default {
  getUsers,
  getUserById,
  getUserByEmail,
  createUser,
  updateUser,
  blockUser,
  unblockUser,
  approveUser,
  markUserApproved,
  markUserDisapproved,
  markUserForApproval,
  changeUserRole,
  requestDataExport,
  eraseUserData,
  getUserStats
};

