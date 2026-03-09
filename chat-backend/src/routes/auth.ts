import { Router, Request, Response } from 'express';
import { sendOtp, verifyOtp } from '../services/otp.service';
import { createRateLimiter } from '../middleware/rateLimiter';
import {
  authenticateWithOtp,
  authenticateWithGoogle,
  refreshTokens,
  invalidateAllRefreshTokens,
  getUserById,
  getAuthUserById,
  logAuditEvent,
  RedisUnavailableError,
  generateAccessToken,
  generateRefreshToken
} from '../services/auth.service';
import { getSettings } from '../services/settings.service';
import { isGoogleOAuthConfigured, getGoogleClientId } from '../services/google-auth.service';
import { markUserForApproval } from '../services/user.service';
import { authenticate, getClientIp } from '../middleware/auth';
import { DbUser } from '../types';
import { query } from '../db';
import { requestMembershipWithInviteCode } from '../services/groupMembership.service';

const router = Router();

/**
 * Shared cookie options for the refresh-token cookie.
 * Domain is set to the parent domain so both chat and workbench
 * surfaces can share the same cookie.
 */
function refreshCookieOptions(maxAge?: number): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax';
  path: string;
  domain?: string;
  maxAge?: number;
} {
  const opts: ReturnType<typeof refreshCookieOptions> = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/auth',
  };
  const cookieDomain = process.env.COOKIE_DOMAIN; // e.g. ".mentalhelp.chat"
  if (cookieDomain) {
    opts.domain = cookieDomain;
  }
  if (maxAge !== undefined) {
    opts.maxAge = maxAge;
  }
  return opts;
}

const otpSendLimiter = createRateLimiter({
  endpointTag: 'otp_send',
  maxRequests: Number(process.env.OTP_REQUEST_RATE_LIMIT_MAX) || 3,
  windowSeconds: Number(process.env.OTP_REQUEST_RATE_LIMIT_WINDOW_SECONDS) || 300,
});

const otpVerifyLimiter = createRateLimiter({
  endpointTag: 'otp_verify',
  maxRequests: Number(process.env.OTP_RATE_LIMIT_MAX) || 5,
  windowSeconds: Number(process.env.OTP_RATE_LIMIT_WINDOW_SECONDS) || 60,
});

/**
 * POST /api/auth/otp/send
 * Send OTP to email address
 */
router.post('/otp/send', otpSendLimiter, async (req: Request, res: Response) => {
  try {
    const { email, surface } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Email is required'
        }
      });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_EMAIL',
          message: 'Invalid email format'
        }
      });
    }

    // Check if user is blocked
    const existingUser = await query<DbUser>(
      'SELECT status FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    if (existingUser.rows.length > 0 && existingUser.rows[0].status === 'blocked') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCOUNT_BLOCKED',
          message: 'This account has been blocked'
        }
      });
    }

    if (surface === 'workbench' && !process.env.FORCE_ENABLE_OTP) {
      const settings = await getSettings();
      if (settings.otpLoginDisabledWorkbench) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'OTP_DISABLED_WORKBENCH',
            message: 'OTP login is disabled for the workbench'
          }
        });
      }
    }

    const result = await sendOtp(email);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'OTP_SEND_FAILED',
          message: result.error || 'Failed to send verification code'
        }
      });
    }

    res.json({
      success: true,
      data: {
        message: 'Verification code sent',
        email: email.toLowerCase().trim(),
        // Include code for development (console provider only)
        ...(result.code && { devCode: result.code })
      }
    });
  } catch (error) {
    console.error('[Auth] Error sending OTP:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to send verification code'
      }
    });
  }
});

/**
 * POST /api/auth/otp/verify
 * Verify OTP and authenticate user
 */
router.post('/otp/verify', otpVerifyLimiter, async (req: Request, res: Response) => {
  try {
    const { email, code, invitationCode, inviteCode } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Email is required'
        }
      });
    }

    if (!code || typeof code !== 'string' || code.length !== 6) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'A 6-digit code is required'
        }
      });
    }

    // Verify the OTP
    const verification = await verifyOtp(email, code);

    if (!verification.valid) {
      const errorMessages: Record<string, string> = {
        no_otp_found: 'No verification code found. Please request a new one.',
        otp_expired: 'Verification code has expired. Please request a new one.',
        max_attempts_exceeded: 'Too many failed attempts. Please request a new code.',
        invalid_otp: 'Invalid verification code.',
        verification_failed: 'Verification failed. Please try again.'
      };

      return res.status(400).json({
        success: false,
        error: {
          code: verification.error?.toUpperCase() || 'VERIFICATION_FAILED',
          message: errorMessages[verification.error || ''] || 'Verification failed'
        }
      });
    }

    // Authenticate user (creates account if needed)
    const authResult = await authenticateWithOtp(email);
    const userId = authResult.user.id;
    const dbUser = await getUserById(userId);

    let effectiveStatus = authResult.status;
    if (authResult.status === 'disapproved') {
      const settings = await getSettings();
      const cooloffDays = settings.approvalCooloffDays || 7;
      const disapprovedAt = dbUser?.disapproved_at ? new Date(dbUser.disapproved_at).getTime() : 0;
      const cooloffUntil = disapprovedAt + cooloffDays * 24 * 60 * 60 * 1000;

      if (disapprovedAt && Date.now() < cooloffUntil) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'DISAPPROVED_COOLING_OFF',
            message: 'Account disapproved. Please re-apply after the cooloff period.',
            details: { cooloffUntil: new Date(cooloffUntil).toISOString() }
          }
        });
      }

      await markUserForApproval(userId);
      effectiveStatus = 'approval';
    }

    const rawInvite =
      typeof invitationCode === 'string' && invitationCode.trim()
        ? invitationCode
        : typeof inviteCode === 'string' && inviteCode.trim()
          ? inviteCode
          : null;

    if (rawInvite) {
      const trimmed = rawInvite.trim();
      if (!/^[a-z0-9]+$/i.test(trimmed)) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INVITATION_CODE', message: 'Invitation code must be alphanumeric' }
        });
      }

      try {
        const membershipResult = await requestMembershipWithInviteCode(
          { userId, code: trimmed },
          getClientIp(req) || undefined
        );
        if (membershipResult.status === 'active') {
          effectiveStatus = 'active';
        }
      } catch (e: any) {
        const msg = String(e?.message || '');
        const codeMap: Record<string, { status: number; code: string; message: string }> = {
          INVITE_NOT_FOUND: { status: 404, code: 'INVITATION_CODE_NOT_FOUND', message: 'Invitation code not found' },
          INVITE_REVOKED: { status: 400, code: 'INVALID_INVITATION_CODE', message: 'Invitation code is invalid' },
          INVITE_EXPIRED: { status: 400, code: 'INVALID_INVITATION_CODE', message: 'Invitation code is invalid' },
          INVITE_MAX_USES: { status: 400, code: 'INVALID_INVITATION_CODE', message: 'Invitation code is invalid' },
          GROUP_ARCHIVED: { status: 400, code: 'INVALID_INVITATION_CODE', message: 'Invitation code is invalid' },
          INVALID_INVITE_CODE: { status: 400, code: 'INVALID_INVITATION_CODE', message: 'Invitation code is invalid' }
        };
        const mapped = codeMap[msg];
        if (mapped) {
          return res.status(mapped.status).json({
            success: false,
            error: { code: mapped.code, message: mapped.message }
          });
        }
        console.error('[Auth] Invite code processing failed:', e);
        return res.status(500).json({
          success: false,
          error: { code: 'INVITE_PROCESSING_FAILED', message: 'Failed to process invite code' }
        });
      }
    }

    if (effectiveStatus !== 'active') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCOUNT_PENDING_APPROVAL',
          message: 'Your account is awaiting approval'
        }
      });
    }

    let accessToken = authResult.accessToken;
    let refreshToken = authResult.refreshToken;
    if (effectiveStatus === 'active' && (!accessToken || !refreshToken)) {
      const refreshedUser = await getUserById(userId);
      if (refreshedUser && refreshedUser.status === 'active') {
        accessToken = generateAccessToken(refreshedUser);
        refreshToken = await generateRefreshToken(refreshedUser.id);
      }
    }

    // Set refresh token as httpOnly cookie
    if (!refreshToken || !accessToken) {
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to issue authentication tokens' }
      });
    }

    res.cookie('refreshToken', refreshToken, refreshCookieOptions(7 * 24 * 60 * 60 * 1000));

    res.json({
      success: true,
      data: {
        accessToken,
        user: authResult.user,
        isNewUser: authResult.isNewUser
      }
    });
  } catch (error) {
    console.error('[Auth] Error verifying OTP:', error);
    
    if ((error as Error).message === 'Account is blocked') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCOUNT_BLOCKED',
          message: 'This account has been blocked'
        }
      });
    }

    if (error instanceof RedisUnavailableError) {
      return res.status(503).json({
        success: false,
        error: {
          code: 'TOKEN_STORE_UNAVAILABLE',
          message: 'Authentication service temporarily unavailable'
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Authentication failed'
      }
    });
  }
});

/**
 * POST /api/auth/google
 * Authenticate via Google OAuth
 */
router.post('/google', async (req: Request, res: Response) => {
  try {
    if (!isGoogleOAuthConfigured()) {
      return res.status(400).json({
        success: false,
        error: { code: 'GOOGLE_OAUTH_NOT_CONFIGURED', message: 'Google OAuth is not available' }
      });
    }

    const { credential, invitationCode, inviteCode, surface } = req.body;

    if (!credential || typeof credential !== 'string') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'Google credential is required' }
      });
    }

    let authResult;
    try {
      authResult = await authenticateWithGoogle(credential);
    } catch (err: any) {
      if (err instanceof RedisUnavailableError) throw err;
      const msg = err?.message || '';
      if (msg.includes('Account is blocked')) {
        return res.status(403).json({
          success: false,
          error: { code: 'ACCOUNT_BLOCKED', message: 'This account has been blocked' }
        });
      }
      console.error('[Auth] Google token verification failed:', msg);
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_GOOGLE_TOKEN', message: 'Invalid or expired Google credential' }
      });
    }

    const userId = authResult.user.id;
    const dbUser = await getUserById(userId);

    let effectiveStatus = authResult.status;
    if (authResult.status === 'disapproved') {
      const settings = await getSettings();
      const cooloffDays = settings.approvalCooloffDays || 7;
      const disapprovedAt = dbUser?.disapproved_at ? new Date(dbUser.disapproved_at).getTime() : 0;
      const cooloffUntil = disapprovedAt + cooloffDays * 24 * 60 * 60 * 1000;

      if (disapprovedAt && Date.now() < cooloffUntil) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'DISAPPROVED_COOLING_OFF',
            message: 'Account disapproved. Please re-apply after the cooloff period.',
            details: { cooloffUntil: new Date(cooloffUntil).toISOString() }
          }
        });
      }

      await markUserForApproval(userId);
      effectiveStatus = 'approval';
    }

    const rawInvite =
      typeof invitationCode === 'string' && invitationCode.trim()
        ? invitationCode
        : typeof inviteCode === 'string' && inviteCode.trim()
          ? inviteCode
          : null;

    if (rawInvite) {
      const trimmed = rawInvite.trim();
      if (!/^[a-z0-9]+$/i.test(trimmed)) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INVITATION_CODE', message: 'Invitation code must be alphanumeric' }
        });
      }

      try {
        const membershipResult = await requestMembershipWithInviteCode(
          { userId, code: trimmed },
          getClientIp(req) || undefined
        );
        if (membershipResult.status === 'active') {
          effectiveStatus = 'active';
        }
      } catch (e: any) {
        const msg = String(e?.message || '');
        if (['INVITE_NOT_FOUND', 'INVITE_REVOKED', 'INVITE_EXPIRED', 'INVITE_MAX_USES', 'GROUP_ARCHIVED', 'INVALID_INVITE_CODE'].includes(msg)) {
          return res.status(400).json({
            success: false,
            error: { code: 'INVALID_INVITATION_CODE', message: 'Invitation code is invalid' }
          });
        }
        console.error('[Auth] Invite code processing failed:', e);
      }
    }

    await logAuditEvent(
      userId,
      'google_oauth_login',
      'user',
      userId,
      { surface: surface || 'unknown', isNew: authResult.isNewUser },
      getClientIp(req)
    );

    if (effectiveStatus !== 'active') {
      return res.status(202).json({
        success: true,
        data: {
          status: effectiveStatus,
          message: 'Your account is awaiting approval',
          user: authResult.user
        }
      });
    }

    let accessToken = authResult.accessToken;
    let refreshToken = authResult.refreshToken;
    if (effectiveStatus === 'active' && (!accessToken || !refreshToken)) {
      const refreshedUser = await getUserById(userId);
      if (refreshedUser && refreshedUser.status === 'active') {
        accessToken = generateAccessToken(refreshedUser);
        refreshToken = await generateRefreshToken(refreshedUser.id);
      }
    }

    if (!refreshToken || !accessToken) {
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to issue authentication tokens' }
      });
    }

    res.cookie('refreshToken', refreshToken, refreshCookieOptions(7 * 24 * 60 * 60 * 1000));

    res.json({
      success: true,
      data: {
        accessToken,
        user: authResult.user,
        isNewUser: authResult.isNewUser
      }
    });
  } catch (error) {
    if (error instanceof RedisUnavailableError) {
      return res.status(503).json({
        success: false,
        error: { code: 'TOKEN_STORE_UNAVAILABLE', message: 'Authentication service temporarily unavailable' }
      });
    }
    console.error('[Auth] Error in Google OAuth:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Authentication failed' }
    });
  }
});

/**
 * GET /api/auth/google/config
 * Return Google OAuth client configuration (public)
 */
router.get('/google/config', (_req: Request, res: Response) => {
  const clientId = getGoogleClientId();
  res.json({
    success: true,
    data: {
      clientId,
      available: !!clientId
    }
  });
});

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    // CSRF protection: verify origin for cross-origin requests
    const origin = req.headers.origin;
    if (origin) {
      const allowedEnvUrls = [
        process.env.FRONTEND_URL || 'http://localhost:5173',
        process.env.WORKBENCH_FRONTEND_URL,
      ].filter(Boolean) as string[];

      const isLocalhost = origin.match(/^http:\/\/localhost:\d+$/);
      const isGcs = origin === 'https://storage.googleapis.com';
      const isAllowedEnv = allowedEnvUrls.some((envUrl) => {
        try {
          return origin === new URL(envUrl).origin;
        } catch {
          return origin === envUrl;
        }
      });

      if (!isLocalhost && !isGcs && !isAllowedEnv) {
        console.warn(`[Auth] Rejected refresh request from unauthorized origin: ${origin}`);
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN_ORIGIN',
            message: 'Request origin not allowed'
          }
        });
      }
    }

    // Get refresh token from cookie or body
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

    if (!refreshToken) {
      console.warn('[Auth] Refresh request without token');
      return res.status(401).json({
        success: false,
        error: {
          code: 'NO_REFRESH_TOKEN',
          message: 'Refresh token is required'
        }
      });
    }

    const result = await refreshTokens(refreshToken);

    if (!result) {
      console.warn('[Auth] Invalid refresh token attempt');
      res.clearCookie('refreshToken', refreshCookieOptions(0));
      
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_REFRESH_TOKEN',
          message: 'Invalid or expired refresh token'
        }
      });
    }

    res.cookie('refreshToken', result.refreshToken, refreshCookieOptions(7 * 24 * 60 * 60 * 1000));

    console.log(`[Auth] Successfully refreshed token for user: ${result.user.id}`);

    res.json({
      success: true,
      data: {
        accessToken: result.accessToken,
        user: result.user
      }
    });
  } catch (error) {
    if (error instanceof RedisUnavailableError) {
      return res.status(503).json({
        success: false,
        error: {
          code: 'TOKEN_STORE_UNAVAILABLE',
          message: 'Token refresh service temporarily unavailable'
        }
      });
    }
    console.error('[Auth] Error refreshing token:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to refresh token'
      }
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout user and invalidate refresh token
 */
router.post('/logout', authenticate, async (req: Request, res: Response) => {
  try {
    if (req.userId) {
      await invalidateAllRefreshTokens(req.userId);
    }

    res.clearCookie('refreshToken', refreshCookieOptions(0));

    res.json({
      success: true,
      data: {
        message: 'Logged out successfully'
      }
    });
  } catch (error) {
    if (error instanceof RedisUnavailableError) {
      return res.status(503).json({
        success: false,
        error: {
          code: 'TOKEN_STORE_UNAVAILABLE',
          message: 'Logout service temporarily unavailable'
        }
      });
    }
    console.error('[Auth] Error logging out:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Logout failed'
      }
    });
  }
});

/**
 * GET /api/auth/me
 * Get current authenticated user
 */
router.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Not authenticated'
        }
      });
    }

    const authUser = await getAuthUserById(req.userId);

    if (!authUser) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        }
      });
    }

    if (authUser.status === 'blocked') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCOUNT_BLOCKED',
          message: 'Your account has been blocked'
        }
      });
    }

    if (authUser.status === 'approval' || authUser.status === 'pending') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCOUNT_PENDING_APPROVAL',
          message: 'Your account is awaiting approval'
        }
      });
    }

    if (authUser.status === 'disapproved') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCOUNT_DISAPPROVED',
          message: 'Your account was disapproved'
        }
      });
    }

    res.json({
      success: true,
      data: authUser
    });
  } catch (error) {
    console.error('[Auth] Error getting current user:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get user data'
      }
    });
  }
});

export default router;

