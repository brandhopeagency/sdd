import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, getUserById, getAuthUserById } from '../services/auth.service';
import { Permission, ROLE_PERMISSIONS, AuthenticatedUser } from '../types';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      userId?: string;
    }
  }
}

/**
 * Authentication middleware
 * Verifies JWT access token and attaches user to request
 */
export function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'No authentication token provided'
      }
    });
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix
  const payload = verifyAccessToken(token);

  if (!payload) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired authentication token'
      }
    });
  }

  // Attach user info to request
  req.userId = payload.sub;
  req.user = {
    id: payload.sub,
    email: payload.email,
    displayName: '', // Will be populated if needed
    role: payload.role,
    permissions: ROLE_PERMISSIONS[payload.role] || [],
    groupId: null,
    status: 'active',
    createdAt: new Date(),
    lastLoginAt: new Date()
  };

  next();
}

/**
 * Optional authentication middleware
 * Attaches user to request if token is valid, but doesn't require it
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.substring(7);
  const payload = verifyAccessToken(token);

  if (payload) {
    req.userId = payload.sub;
    req.user = {
      id: payload.sub,
      email: payload.email,
      displayName: '',
      role: payload.role,
      permissions: ROLE_PERMISSIONS[payload.role] || [],
      groupId: null,
      status: 'active',
      createdAt: new Date(),
      lastLoginAt: new Date()
    };
  }

  next();
}

/**
 * Optional auth + active-account enforcement for token-bearing requests.
 * - If no token (guest), request proceeds.
 * - If token is present and valid, user must be active (not pending/blocked/anonymized).
 */
export async function optionalAuthActiveAccount(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.substring(7);
  const payload = verifyAccessToken(token);
  if (!payload) {
    return next(); // treat invalid token as unauthenticated for optional endpoints
  }

  req.userId = payload.sub;

  try {
    const authUser = await getAuthUserById(payload.sub);
    if (!authUser) {
      return res.status(401).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User account not found' }
      });
    }

    if (authUser.status === 'blocked') {
      return res.status(403).json({
        success: false,
        error: { code: 'ACCOUNT_BLOCKED', message: 'Your account has been blocked' }
      });
    }

    if (authUser.status === 'approval' || authUser.status === 'pending') {
      return res.status(403).json({
        success: false,
        error: { code: 'ACCOUNT_PENDING_APPROVAL', message: 'Your account is awaiting approval' }
      });
    }

    if (authUser.status === 'disapproved') {
      return res.status(403).json({
        success: false,
        error: { code: 'ACCOUNT_DISAPPROVED', message: 'Your account was disapproved' }
      });
    }

    if (authUser.status === 'anonymized') {
      return res.status(403).json({
        success: false,
        error: { code: 'ACCOUNT_DELETED', message: 'This account has been deleted' }
      });
    }

    req.user = authUser;
    return next();
  } catch (error) {
    console.error('[Auth] Error checking optional account status:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to verify account status' }
    });
  }
}

/**
 * Permission check middleware factory
 * Creates middleware that checks if user has required permission
 */
export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
    }

    if (!req.user.permissions.includes(permission)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Missing required permission: ${permission}`
        }
      });
    }

    next();
  };
}

/**
 * Multiple permissions check middleware factory
 * Creates middleware that checks if user has ALL required permissions
 */
export function requireAllPermissions(...permissions: Permission[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
    }

    const missingPermissions = permissions.filter(p => !req.user!.permissions.includes(p));
    
    if (missingPermissions.length > 0) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Missing required permissions: ${missingPermissions.join(', ')}`
        }
      });
    }

    next();
  };
}

/**
 * Any permission check middleware factory
 * Creates middleware that checks if user has ANY of the required permissions
 */
export function requireAnyPermission(...permissions: Permission[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
    }

    const hasPermission = permissions.some(p => req.user!.permissions.includes(p));
    
    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Requires one of these permissions: ${permissions.join(', ')}`
        }
      });
    }

    next();
  };
}

/**
 * Middleware to ensure user account is not blocked
 */
export async function requireActiveAccount(req: Request, res: Response, next: NextFunction) {
  if (!req.userId) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required'
      }
    });
  }

  try {
    const user = await getUserById(req.userId);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User account not found'
        }
      });
    }

    if (user.status === 'blocked') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCOUNT_BLOCKED',
          message: 'Your account has been blocked'
        }
      });
    }

    if (user.status === 'approval' || user.status === 'pending') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCOUNT_PENDING_APPROVAL',
          message: 'Your account is awaiting approval'
        }
      });
    }

    if (user.status === 'disapproved') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCOUNT_DISAPPROVED',
          message: 'Your account was disapproved'
        }
      });
    }

    if (user.status === 'anonymized') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCOUNT_DELETED',
          message: 'This account has been deleted'
        }
      });
    }

    // Update request user with full data (including memberships)
    const authUser = await getAuthUserById(req.userId);
    if (!authUser) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User account not found'
        }
      });
    }
    req.user = authUser;
    
    next();
  } catch (error) {
    console.error('[Auth] Error checking account status:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to verify account status'
      }
    });
  }
}

/**
 * Get client IP address from request
 */
export function getClientIp(req: Request): string | null {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const first = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    const ip = first.split(',')[0];
    return ip.trim();
  }
  return req.socket.remoteAddress || null;
}

export default {
  authenticate,
  optionalAuth,
  optionalAuthActiveAccount,
  requirePermission,
  requireAllPermissions,
  requireAnyPermission,
  requireActiveAccount,
  getClientIp
};

