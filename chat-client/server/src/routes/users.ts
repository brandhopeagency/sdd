import { Router, Request, Response } from 'express';
import { 
  authenticate, 
  requireActiveAccount,
  requirePermission, 
  getClientIp 
} from '../middleware/auth';
import { 
  getUsers, 
  getUserById, 
  createUser,
  updateUser, 
  blockUser, 
  unblockUser, 
  approveUser,
  changeUserRole,
  requestDataExport,
  eraseUserData,
  getUserStats
} from '../services/user.service';
import { Permission, UserRole, UserStatus, PaginationParams } from '../types';

const router = Router();

// All routes require authentication
router.use(authenticate);
router.use(requireActiveAccount);

function canViewPii(req: Request): boolean {
  return req.user?.permissions.includes(Permission.DATA_VIEW_PII) ?? false;
}

function redactUserForPii<T extends { email?: string; displayName?: string }>(user: T): T {
  return {
    ...user,
    email: user.email ? '***@***.***' : user.email,
    displayName: user.displayName ? '***' : user.displayName
  };
}

/**
 * GET /api/admin/users
 * List users with pagination and filtering
 */
router.get(
  '/',
  requirePermission(Permission.WORKBENCH_USER_MANAGEMENT),
  async (req: Request, res: Response) => {
    try {
      const params: PaginationParams = {
        page: parseInt(req.query.page as string) || 1,
        limit: Math.min(parseInt(req.query.limit as string) || 10, 100),
        search: (req.query.search as string) || '',
        role: (req.query.role as UserRole | 'all') || 'all',
        status: (req.query.status as UserStatus | 'all') || 'all',
        sortBy: (req.query.sortBy as string) || 'created_at',
        sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc'
      };

      const result = await getUsers(params, {
        includePiiSearch: canViewPii(req),
        includePiiSort: canViewPii(req)
      });
      const users = canViewPii(req) ? result.users : result.users.map(redactUserForPii);

      res.json({
        success: true,
        data: users,
        meta: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          hasMore: result.hasMore
        }
      });
    } catch (error) {
      console.error('[Users] Error listing users:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to list users'
        }
      });
    }
  }
);

/**
 * POST /api/admin/users
 * Create a new user
 */
router.post(
  '/',
  requirePermission(Permission.WORKBENCH_USER_MANAGEMENT),
  async (req: Request, res: Response) => {
    try {
      const { email, displayName, role, status } = req.body;

      // Validate required fields
      if (!email || typeof email !== 'string') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Email is required'
          }
        });
      }

      if (!displayName || typeof displayName !== 'string') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Display name is required'
          }
        });
      }

      // Validate role if provided
      if (role && !Object.values(UserRole).includes(role)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_ROLE',
            message: 'Invalid role specified'
          }
        });
      }

      // Validate status if provided
      const validStatuses: UserStatus[] = ['active', 'blocked', 'pending', 'approval', 'disapproved', 'anonymized'];
      if (status && !validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_STATUS',
            message: 'Invalid status specified'
          }
        });
      }

      // Only owners can set roles other than 'user'
      const finalRole = role || UserRole.USER;
      if (finalRole !== UserRole.USER && req.user?.role !== UserRole.OWNER) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Only owners can create users with roles other than user'
          }
        });
      }

      try {
        const user = await createUser(
          {
            email,
            displayName,
            role: finalRole,
            status: status || 'active'
          },
          req.userId!,
          getClientIp(req) || undefined
        );

        res.status(201).json({
          success: true,
          data: canViewPii(req) ? user : redactUserForPii(user)
        });
      } catch (error: any) {
        if (error.message === 'EMAIL_ALREADY_EXISTS') {
          return res.status(409).json({
            success: false,
            error: {
              code: 'EMAIL_ALREADY_EXISTS',
              message: 'A user with this email already exists'
            }
          });
        }
        if (error.message === 'INVALID_EMAIL_FORMAT') {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_EMAIL_FORMAT',
              message: 'Invalid email format'
            }
          });
        }
        throw error;
      }
    } catch (error) {
      console.error('[Users] Error creating user:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create user'
        }
      });
    }
  }
);

/**
 * GET /api/admin/users/stats
 * Get user statistics
 */
router.get(
  '/stats',
  requirePermission(Permission.WORKBENCH_USER_MANAGEMENT),
  async (req: Request, res: Response) => {
    try {
      const stats = await getUserStats();

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('[Users] Error getting stats:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get user statistics'
        }
      });
    }
  }
);

/**
 * GET /api/admin/users/:id
 * Get user by ID
 */
router.get(
  '/:id',
  requirePermission(Permission.WORKBENCH_USER_MANAGEMENT),
  async (req: Request, res: Response) => {
    try {
      const user = await getUserById(req.params.id);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found'
          }
        });
      }

      res.json({
        success: true,
        data: canViewPii(req) ? user : redactUserForPii(user)
      });
    } catch (error) {
      console.error('[Users] Error getting user:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get user'
        }
      });
    }
  }
);

/**
 * PATCH /api/admin/users/:id
 * Update user
 */
router.patch(
  '/:id',
  requirePermission(Permission.WORKBENCH_USER_MANAGEMENT),
  async (req: Request, res: Response) => {
    try {
      const { displayName, role, status, groupId } = req.body;
      
      // Validate role if provided
      if (role && !Object.values(UserRole).includes(role)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_ROLE',
            message: 'Invalid role specified'
          }
        });
      }

      // Validate status if provided
      const validStatuses = ['active', 'blocked', 'pending', 'approval', 'disapproved', 'anonymized'];
      if (status && !validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_STATUS',
            message: 'Invalid status specified'
          }
        });
      }

      if (groupId !== undefined) {
        // Only owners can change group assignment (bootstrap + security boundary)
        if (req.user?.role !== UserRole.OWNER) {
          return res.status(403).json({
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'Only owners can change user group assignment'
            }
          });
        }

        const isUuid =
          typeof groupId === 'string' &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(groupId);
        const isNull = groupId === null;
        if (!isUuid && !isNull) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_REQUEST',
              message: 'groupId must be a UUID string or null'
            }
          });
        }
      }

      // Only owners can change roles
      if (role && req.user?.role !== UserRole.OWNER) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Only owners can change user roles'
          }
        });
      }

      const user = await updateUser(
        req.params.id,
        { displayName, role, status, groupId },
        req.userId!,
        getClientIp(req) || undefined
      );

      if (!user) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found'
          }
        });
      }

      res.json({
        success: true,
        data: canViewPii(req) ? user : redactUserForPii(user)
      });
    } catch (error) {
      console.error('[Users] Error updating user:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update user'
        }
      });
    }
  }
);

/**
 * POST /api/admin/users/:id/block
 * Block a user
 */
router.post(
  '/:id/block',
  requirePermission(Permission.WORKBENCH_USER_MANAGEMENT),
  async (req: Request, res: Response) => {
    try {
      const { reason } = req.body;

      if (!reason || typeof reason !== 'string') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Block reason is required'
          }
        });
      }

      // Prevent self-blocking
      if (req.params.id === req.userId) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'CANNOT_BLOCK_SELF',
            message: 'You cannot block yourself'
          }
        });
      }

      const user = await blockUser(
        req.params.id,
        reason,
        req.userId!,
        getClientIp(req) || undefined
      );

      if (!user) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found'
          }
        });
      }

      res.json({
        success: true,
        data: canViewPii(req) ? user : redactUserForPii(user)
      });
    } catch (error) {
      console.error('[Users] Error blocking user:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to block user'
        }
      });
    }
  }
);

/**
 * POST /api/admin/users/:id/unblock
 * Unblock a user
 */
router.post(
  '/:id/unblock',
  requirePermission(Permission.WORKBENCH_USER_MANAGEMENT),
  async (req: Request, res: Response) => {
    try {
      const user = await unblockUser(
        req.params.id,
        req.userId!,
        getClientIp(req) || undefined
      );

      if (!user) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found'
          }
        });
      }

      res.json({
        success: true,
        data: canViewPii(req) ? user : redactUserForPii(user)
      });
    } catch (error) {
      console.error('[Users] Error unblocking user:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to unblock user'
        }
      });
    }
  }
);

/**
 * POST /api/admin/users/:id/approve
 * Approve (activate) a pending user (System admin).
 */
router.post(
  '/:id/approve',
  requirePermission(Permission.WORKBENCH_USER_MANAGEMENT),
  async (req: Request, res: Response) => {
    try {
      // Prevent self-approval (mostly meaningless, but keeps audit clean)
      if (req.params.id === req.userId) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'CANNOT_APPROVE_SELF',
            message: 'You cannot approve yourself'
          }
        });
      }

      const user = await approveUser(req.params.id, req.userId!, getClientIp(req) || undefined);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Pending user not found' }
        });
      }

      return res.json({
        success: true,
        data: canViewPii(req) ? user : redactUserForPii(user)
      });
    } catch (error) {
      console.error('[Users] Error approving user:', error);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to approve user' }
      });
    }
  }
);

/**
 * POST /api/admin/users/:id/role
 * Change user role (Owner only)
 */
router.post(
  '/:id/role',
  requirePermission(Permission.WORKBENCH_USER_MANAGEMENT),
  async (req: Request, res: Response) => {
    try {
      // Only owners can change roles
      if (req.user?.role !== UserRole.OWNER) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Only owners can change user roles'
          }
        });
      }

      const { role } = req.body;

      if (!role || !Object.values(UserRole).includes(role)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_ROLE',
            message: 'Valid role is required'
          }
        });
      }

      const user = await changeUserRole(
        req.params.id,
        role,
        req.userId!,
        getClientIp(req) || undefined
      );

      if (!user) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found'
          }
        });
      }

      res.json({
        success: true,
        data: canViewPii(req) ? user : redactUserForPii(user)
      });
    } catch (error) {
      console.error('[Users] Error changing role:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to change user role'
        }
      });
    }
  }
);

/**
 * POST /api/admin/users/:id/export
 * Request data export (GDPR)
 */
router.post(
  '/:id/export',
  requirePermission(Permission.WORKBENCH_PRIVACY),
  async (req: Request, res: Response) => {
    try {
      const result = await requestDataExport(
        req.params.id,
        req.userId!,
        getClientIp(req) || undefined
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('[Users] Error requesting export:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to request data export'
        }
      });
    }
  }
);

/**
 * POST /api/admin/users/:id/erase
 * Execute GDPR erasure
 */
router.post(
  '/:id/erase',
  requirePermission(Permission.WORKBENCH_PRIVACY),
  async (req: Request, res: Response) => {
    try {
      const { reason, confirmationCode } = req.body;

      if (!reason || typeof reason !== 'string') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Erasure reason is required'
          }
        });
      }

      // Prevent self-erasure
      if (req.params.id === req.userId) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'CANNOT_ERASE_SELF',
            message: 'You cannot erase your own account'
          }
        });
      }

      const user = await eraseUserData(
        req.params.id,
        reason,
        req.userId!,
        getClientIp(req) || undefined
      );

      if (!user) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found'
          }
        });
      }

      res.json({
        success: true,
        data: canViewPii(req) ? user : redactUserForPii(user)
      });
    } catch (error) {
      console.error('[Users] Error erasing user:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to erase user data'
        }
      });
    }
  }
);

export default router;

