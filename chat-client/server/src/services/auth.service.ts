import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { query } from '../db';
import {
  DbUser,
  JwtPayload,
  RefreshTokenPayload,
  AuthenticatedUser,
  UserRole,
  UserStatus,
  ROLE_PERMISSIONS,
  dbUserToAuthUser
} from '../types';
import { resolveUserGroupContext } from './groupMembership.service';

const BCRYPT_ROUNDS = 10;

// JWT configuration
const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters');
  }
  return secret;
};

const getRefreshSecret = () => {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_REFRESH_SECRET must be at least 32 characters');
  }
  return secret;
};

const getAccessTokenExpiry = () => process.env.JWT_ACCESS_EXPIRES_IN || '15m';
const getRefreshTokenExpiry = () => process.env.JWT_REFRESH_EXPIRES_IN || '7d';

/**
 * Parse duration string to milliseconds
 */
function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) return 15 * 60 * 1000; // default 15 minutes
  
  const value = parseInt(match[1]);
  const unit = match[2];
  
  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: return 15 * 60 * 1000;
  }
}

/**
 * Generate access token for a user
 */
export function generateAccessToken(user: DbUser): string {
  const payload: JwtPayload = {
    sub: user.id,
    email: user.email,
    role: user.role
  };
  
  const expiresIn = getAccessTokenExpiry();
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: expiresIn as jwt.SignOptions['expiresIn']
  });
}

/**
 * Generate refresh token for a user
 */
export async function generateRefreshToken(userId: string): Promise<string> {
  const tokenId = crypto.randomUUID();
  const expiryMs = parseDuration(getRefreshTokenExpiry());
  const expiresAt = new Date(Date.now() + expiryMs);
  
  const payload: RefreshTokenPayload = {
    sub: userId,
    tokenId
  };
  
  const expiresIn = getRefreshTokenExpiry();
  const token = jwt.sign(payload, getRefreshSecret(), {
    expiresIn: expiresIn as jwt.SignOptions['expiresIn']
  });
  
  // Store hashed token in database
  const tokenHash = await bcrypt.hash(tokenId, BCRYPT_ROUNDS);
  
  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) 
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt]
  );
  
  return token;
}

/**
 * Verify access token and return payload
 */
export function verifyAccessToken(token: string): JwtPayload | null {
  try {
    const payload = jwt.verify(token, getJwtSecret()) as JwtPayload;
    return payload;
  } catch (error) {
    return null;
  }
}

/**
 * Verify refresh token and return new tokens
 */
export async function refreshTokens(
  refreshToken: string
): Promise<{ accessToken: string; refreshToken: string; user: AuthenticatedUser } | null> {
  try {
    const payload = jwt.verify(refreshToken, getRefreshSecret()) as RefreshTokenPayload;
    
    // Find the user
    const userResult = await query<DbUser>(
      'SELECT * FROM users WHERE id = $1',
      [payload.sub]
    );
    
    if (userResult.rows.length === 0) {
      return null;
    }
    
    const user = userResult.rows[0];
    
    // Check if user is blocked
    if (user.status === 'blocked') {
      return null;
    }
    
    // Find valid refresh token
    const tokenResult = await query(
      `SELECT * FROM refresh_tokens 
       WHERE user_id = $1 AND expires_at > NOW()
       ORDER BY created_at DESC`,
      [payload.sub]
    );
    
    // Verify token exists
    let validToken = false;
    for (const row of tokenResult.rows) {
      if (await bcrypt.compare(payload.tokenId, row.token_hash)) {
        validToken = true;
        // Delete the used token (rotation)
        await query('DELETE FROM refresh_tokens WHERE id = $1', [row.id]);
        break;
      }
    }
    
    if (!validToken) {
      return null;
    }
    
    // Generate new tokens
    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = await generateRefreshToken(user.id);

    let ctx: Awaited<ReturnType<typeof resolveUserGroupContext>> = {
      activeGroupId: null,
      groupRole: null,
      memberships: []
    };
    try {
      ctx = await resolveUserGroupContext(user.id);
    } catch (e) {
      console.warn('[Auth] Failed to resolve group context (refresh):', e);
    }

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: dbUserToAuthUser(user, ctx)
    };
  } catch (error) {
    console.error('[Auth] Error refreshing tokens:', error);
    return null;
  }
}

/**
 * Invalidate all refresh tokens for a user (logout from all devices)
 */
export async function invalidateAllRefreshTokens(userId: string): Promise<void> {
  await query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);
}

/**
 * Find or create user by email
 * Returns the user and whether they were newly created
 */
export async function findOrCreateUser(
  email: string
): Promise<{ user: DbUser; isNew: boolean }> {
  const normalizedEmail = email.toLowerCase().trim();
  
  // Try to find existing user
  const existingResult = await query<DbUser>(
    'SELECT * FROM users WHERE email = $1',
    [normalizedEmail]
  );
  
  if (existingResult.rows.length > 0) {
    const user = existingResult.rows[0];
    
    if (user.status === 'active') {
      // Update last login time
      await query(
        `UPDATE users SET last_login_at = NOW(), session_count = session_count + 1 WHERE id = $1`,
        [user.id]
      );

      // Refetch to get updated data
      const updatedResult = await query<DbUser>(
        'SELECT * FROM users WHERE id = $1',
        [user.id]
      );

      return { user: updatedResult.rows[0], isNew: false };
    }

    return { user, isNew: false };
  }
  
  // Create new user
  const displayName = normalizedEmail
    .split('@')[0]
    .replace(/[._]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
  
  const result = await query<DbUser>(
    `INSERT INTO users (email, display_name, role, status, session_count)
     VALUES ($1, $2, $3, $4, 0)
     RETURNING *`,
    [normalizedEmail, displayName, UserRole.USER, 'approval']
  );
  
  return { user: result.rows[0], isNew: true };
}

/**
 * Get user by ID
 */
export async function getUserById(userId: string): Promise<DbUser | null> {
  const result = await query<DbUser>(
    'SELECT * FROM users WHERE id = $1',
    [userId]
  );
  
  return result.rows[0] || null;
}

export async function getAuthUserById(userId: string): Promise<AuthenticatedUser | null> {
  const user = await getUserById(userId);
  if (!user) return null;
  let ctx: Awaited<ReturnType<typeof resolveUserGroupContext>> = {
    activeGroupId: null,
    groupRole: null,
    memberships: []
  };
  try {
    ctx = await resolveUserGroupContext(user.id);
  } catch (e) {
    console.warn('[Auth] Failed to resolve group context (getAuthUserById):', e);
  }
  return dbUserToAuthUser(user, ctx);
}

/**
 * Authenticate with OTP
 * This is the main entry point for OTP-based authentication
 */
export async function authenticateWithOtp(
  email: string
): Promise<{
  accessToken?: string;
  refreshToken?: string;
  user: AuthenticatedUser;
  isNewUser: boolean;
  status: UserStatus;
}> {
  const { user, isNew } = await findOrCreateUser(email);
  
  // Check if user is blocked
  if (user.status === 'blocked') {
    throw new Error('Account is blocked');
  }
  
  let ctx: Awaited<ReturnType<typeof resolveUserGroupContext>> = {
    activeGroupId: null,
    groupRole: null,
    memberships: []
  };
  try {
    ctx = await resolveUserGroupContext(user.id);
  } catch (e) {
    console.warn('[Auth] Failed to resolve group context (authenticate):', e);
  }
  const authUser = dbUserToAuthUser(user, ctx);

  if (user.status !== 'active') {
    console.log(`[Auth] User not active: ${email} (${user.status})`);
    return {
      user: authUser,
      isNewUser: isNew,
      status: user.status
    };
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = await generateRefreshToken(user.id);
  console.log(`[Auth] User authenticated: ${email} (new: ${isNew})`);

  return {
    accessToken,
    refreshToken,
    user: authUser,
    isNewUser: isNew,
    status: user.status
  };
}

/**
 * Log audit event
 */
export async function logAuditEvent(
  actorId: string | null,
  action: string,
  targetType: string,
  targetId: string | null,
  details: Record<string, unknown> = {},
  ipAddress: string | null = null
): Promise<void> {
  await query(
    `INSERT INTO audit_log (actor_id, action, target_type, target_id, details, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [actorId, action, targetType, targetId, JSON.stringify(details), ipAddress]
  );
}

export default {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  refreshTokens,
  invalidateAllRefreshTokens,
  findOrCreateUser,
  getUserById,
  authenticateWithOtp,
  logAuditEvent
};
