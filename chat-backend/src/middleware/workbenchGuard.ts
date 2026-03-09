import { Request, Response, NextFunction } from 'express';
import { Permission } from '../types';

/**
 * Workbench access guard middleware.
 * Rejects requests from users who lack the WORKBENCH_ACCESS permission.
 *
 * IMPORTANT: This middleware expects `req.user` to be populated by `authenticate`
 * middleware running earlier in the chain.  Always mount as:
 *   app.use('/path', authenticate, requireActiveAccount, workbenchGuard);
 */
export function workbenchGuard(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required'
      }
    });
  }

  if (!req.user.permissions.includes(Permission.WORKBENCH_ACCESS)) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Workbench access denied: missing WORKBENCH_ACCESS permission'
      }
    });
  }

  next();
}
