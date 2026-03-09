import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { query } from '../db';
import * as redis from './redis.service';
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
import { verifyGoogleIdToken } from './google-auth.service';

/**
 * Thrown when Redis is unavailable and token operations cannot proceed.
 * Routes should catch this and return HTTP 503.
 */
export class RedisUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RedisUnavailableError';
  }
}

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
 * Parse duration string to seconds (for Redis TTL)
 */
function parseDurationSeconds(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) return 15 * 60; // default 15 minutes

  const value = parseInt(match[1]);
  const unit = match[2];

  switch (unit) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 60 * 60;
    case 'd': return value * 24 * 60 * 60;
    default: return 15 * 60;
  }
}

/**
 * Parse duration string to milliseconds
 */
function parseDuration(duration: string): number {
  return parseDurationSeconds(duration) * 1000;
}

/**
 * Derive a Redis key from a token ID using SHA-256.
 * Fast and deterministic — unlike bcrypt, which is deliberately slow.
 */
function tokenKey(tokenId: string): string {
  const hash = crypto.createHash('sha256').update(tokenId).digest('hex');
  return `refresh:${hash}`;
}

function tokenHash(tokenId: string): string {
  return crypto.createHash('sha256').update(tokenId).digest('hex');
}

function userTokensKey(userId: string): string {
  return `user:${userId}:tokens`;
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
 * Generate refresh token for a user.
 * Stores token data in Redis with TTL instead of PostgreSQL.
 */
export async function generateRefreshToken(userId: string): Promise<string> {
  const tokenId = crypto.randomUUID();
  const ttlSeconds = parseDurationSeconds(getRefreshTokenExpiry());
  const now = Math.floor(Date.now() / 1000);

  const payload: RefreshTokenPayload = {
    sub: userId,
    tokenId
  };

  const expiresIn = getRefreshTokenExpiry();
  const token = jwt.sign(payload, getRefreshSecret(), {
    expiresIn: expiresIn as jwt.SignOptions['expiresIn']
  });

  const hash = tokenHash(tokenId);
  const redisValue = JSON.stringify({
    userId,
    issuedAt: now,
    expiresAt: now + ttlSeconds,
  });

  try {
    await redis.set(tokenKey(tokenId), redisValue, ttlSeconds);
    await redis.sadd(userTokensKey(userId), hash);
  } catch (err) {
    throw new RedisUnavailableError('Failed to persist refresh token');
  }

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
 * Verify refresh token and return new tokens.
 * Validates against Redis and performs atomic token rotation.
 */
export async function refreshTokens(
  refreshToken: string
): Promise<{ accessToken: string; refreshToken: string; user: AuthenticatedUser } | null> {
  try {
    const payload = jwt.verify(refreshToken, getRefreshSecret()) as RefreshTokenPayload;

    // Look up token in Redis
    let stored: string | null;
    try {
      stored = await redis.get(tokenKey(payload.tokenId));
    } catch (err) {
      throw new RedisUnavailableError('Failed to validate refresh token');
    }
    if (!stored) {
      return null;
    }

    const tokenData = JSON.parse(stored) as { userId: string };
    if (tokenData.userId !== payload.sub) {
      return null;
    }

    // Find the user
    const userResult = await query<DbUser>(
      'SELECT * FROM users WHERE id = $1',
      [payload.sub]
    );

    if (userResult.rows.length === 0) {
      return null;
    }

    const user = userResult.rows[0];

    if (user.status === 'blocked') {
      return null;
    }

    // Atomic token rotation via MULTI/EXEC
    const oldHash = tokenHash(payload.tokenId);
    const newTokenId = crypto.randomUUID();
    const newHash = tokenHash(newTokenId);
    const ttlSeconds = parseDurationSeconds(getRefreshTokenExpiry());
    const now = Math.floor(Date.now() / 1000);

    const newRedisValue = JSON.stringify({
      userId: user.id,
      issuedAt: now,
      expiresAt: now + ttlSeconds,
    });

    try {
      const pipeline = redis.multi();
      pipeline.del(tokenKey(payload.tokenId));
      pipeline.srem(userTokensKey(user.id), oldHash);
      pipeline.set(tokenKey(newTokenId), newRedisValue, 'EX', ttlSeconds);
      pipeline.sadd(userTokensKey(user.id), newHash);
      await pipeline.exec();
    } catch (err) {
      throw new RedisUnavailableError('Failed to rotate refresh token');
    }

    // Sign new tokens
    const newRefreshPayload: RefreshTokenPayload = {
      sub: user.id,
      tokenId: newTokenId
    };

    const newAccessToken = generateAccessToken(user);
    const newRefreshJwt = jwt.sign(newRefreshPayload, getRefreshSecret(), {
      expiresIn: getRefreshTokenExpiry() as jwt.SignOptions['expiresIn']
    });

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
      refreshToken: newRefreshJwt,
      user: dbUserToAuthUser(user, ctx)
    };
  } catch (error) {
    console.error('[Auth] Error refreshing tokens:', error);
    return null;
  }
}

/**
 * Invalidate all refresh tokens for a user (logout from all devices).
 * Uses the user token index to find and delete all tokens atomically.
 */
export async function invalidateAllRefreshTokens(userId: string): Promise<void> {
  try {
    const hashes = await redis.smembers(userTokensKey(userId));
    if (hashes.length > 0) {
      const keys = hashes.map(h => `refresh:${h}`);
      await redis.del(...keys);
    }
    await redis.del(userTokensKey(userId));
  } catch (err) {
    throw new RedisUnavailableError('Failed to revoke refresh tokens');
  }
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
 * Authenticate with Google OAuth.
 * Verifies the Google ID token, finds or creates the user,
 * links the google_sub, and issues tokens.
 */
export async function authenticateWithGoogle(
  credential: string
): Promise<{
  accessToken?: string;
  refreshToken?: string;
  user: AuthenticatedUser;
  isNewUser: boolean;
  status: UserStatus;
}> {
  const payload = await verifyGoogleIdToken(credential);
  const email = payload.email!;
  const googleSub = payload.sub;

  const { user, isNew } = await findOrCreateUser(email);

  if (user.status === 'blocked') {
    throw new Error('Account is blocked');
  }

  if (!user.google_sub && googleSub) {
    await query(
      `UPDATE users SET google_sub = $1 WHERE id = $2 AND google_sub IS NULL`,
      [googleSub, user.id]
    );
  }

  let ctx: Awaited<ReturnType<typeof resolveUserGroupContext>> = {
    activeGroupId: null,
    groupRole: null,
    memberships: []
  };
  try {
    ctx = await resolveUserGroupContext(user.id);
  } catch (e) {
    console.warn('[Auth] Failed to resolve group context (google):', e);
  }
  const authUser = dbUserToAuthUser(user, ctx);

  if (user.status !== 'active') {
    console.log(`[Auth] Google user not active: ${email} (${user.status})`);
    return {
      user: authUser,
      isNewUser: isNew,
      status: user.status
    };
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = await generateRefreshToken(user.id);
  console.log(`[Auth] Google user authenticated: ${email} (new: ${isNew})`);

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
  authenticateWithGoogle,
  logAuditEvent
};
