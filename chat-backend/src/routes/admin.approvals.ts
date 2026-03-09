import { Router, Request, Response } from 'express';
import { authenticate, requireActiveAccount, getClientIp } from '../middleware/auth';
import { Permission, UserStatus } from '../types';
import { query } from '../db';
import { getMembershipForUser, setMembershipStatus } from '../services/group.service';
import { markUserApproved, markUserDisapproved } from '../services/user.service';

const router = Router();

router.use(authenticate);
router.use(requireActiveAccount);

function canManageAllApprovals(req: Request): boolean {
  return req.user?.permissions.includes(Permission.WORKBENCH_USER_MANAGEMENT) ?? false;
}

async function requireGroupAdmin(req: Request, res: Response, groupId: string): Promise<boolean> {
  if (!req.userId) return false;
  if (req.user?.role === 'owner') return true;
  const membership = await getMembershipForUser(req.userId, groupId);
  if (!membership || membership.status !== 'active' || membership.role !== 'admin') {
    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Group admin access required' }
    });
    return false;
  }
  return true;
}

function normalizeStatus(status: string): status is UserStatus {
  return ['approval', 'pending'].includes(status);
}

/**
 * GET /api/admin/approvals
 * List pending approvals (optionally scoped by groupId).
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const groupId = typeof req.query.groupId === 'string' ? req.query.groupId : null;
    const canManageAll = canManageAllApprovals(req);

    if (groupId && !canManageAll) {
      const ok = await requireGroupAdmin(req, res, groupId);
      if (!ok) return;
    }

    if (!groupId && !canManageAll) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Approval access required' }
      });
    }

    const baseParams: any[] = [];
    let where = `WHERE u.status IN ('approval','pending')`;
    if (groupId) {
      baseParams.push(groupId);
      where += ` AND gm.group_id = $1 AND gm.status = 'pending'`;
    }

    const result = await query(
      `
        SELECT
          u.*,
          gm.group_id,
          gm.status as membership_status,
          gm.role as membership_role,
          g.name as group_name
        FROM users u
        LEFT JOIN group_memberships gm ON gm.user_id = u.id
        LEFT JOIN groups g ON g.id = gm.group_id
        ${where}
        ORDER BY u.created_at DESC
      `,
      baseParams
    );

    const grouped = new Map<string, any>();
    for (const row of result.rows) {
      const status = row.status;
      if (!normalizeStatus(status)) continue;
      if (!grouped.has(row.id)) {
        grouped.set(row.id, {
          user: {
            id: row.id,
            email: row.email,
            displayName: row.display_name,
            role: row.role,
            status: row.status,
            groupId: row.group_id ?? null,
            approvedBy: row.approved_by ?? null,
            approvedAt: row.approved_at ?? null,
            disapprovedAt: row.disapproved_at ?? null,
            disapprovalComment: row.disapproval_comment ?? null,
            disapprovalCount: row.disapproval_count ?? 0,
            sessionCount: row.session_count,
            lastLoginAt: row.last_login_at,
            metadata: row.metadata,
            createdAt: row.created_at,
            updatedAt: row.updated_at
          },
          pendingGroups: []
        });
      }
      if (row.group_id && row.membership_status === 'pending') {
        grouped.get(row.id).pendingGroups.push({
          groupId: row.group_id,
          groupName: row.group_name ?? null,
          role: row.membership_role
        });
      }
    }

    return res.json({ success: true, data: Array.from(grouped.values()) });
  } catch (error) {
    console.error('[Approvals] Error listing approvals:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to list approvals' }
    });
  }
});

/**
 * POST /api/admin/approvals/:userId/approve
 */
router.post('/:userId/approve', async (req: Request, res: Response) => {
  try {
    const groupId = typeof req.body?.groupId === 'string' ? req.body.groupId : null;
    const comment = typeof req.body?.comment === 'string' ? req.body.comment : undefined;
    const canManageAll = canManageAllApprovals(req);

    if (groupId && !canManageAll) {
      const ok = await requireGroupAdmin(req, res, groupId);
      if (!ok) return;
    }

    if (!groupId && !canManageAll) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Approval access required' }
      });
    }

    if (groupId) {
      const membership = await getMembershipForUser(req.params.userId, groupId);
      if (!membership) {
        return res.status(404).json({
          success: false,
          error: { code: 'GROUP_MEMBERSHIP_NOT_FOUND', message: 'Pending group request not found' }
        });
      }
      if (membership.status !== 'pending') {
        return res.status(409).json({
          success: false,
          error: { code: 'GROUP_REQUEST_NOT_PENDING', message: 'Group request is not pending' }
        });
      }
      const updated = await setMembershipStatus(
        { userId: req.params.userId, groupId, status: 'active' },
        req.userId!,
        getClientIp(req) || undefined
      );
      if (!updated) {
        return res.status(404).json({
          success: false,
          error: { code: 'GROUP_MEMBERSHIP_NOT_FOUND', message: 'Pending group request not found' }
        });
      }
    } else {
      await query(
        `UPDATE group_memberships SET status = 'active' WHERE user_id = $1 AND status = 'pending'`,
        [req.params.userId]
      );
    }

    const user = await markUserApproved(req.params.userId, req.userId!, comment, getClientIp(req) || undefined);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' }
      });
    }

    return res.json({ success: true, data: user });
  } catch (error) {
    console.error('[Approvals] Error approving user:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to approve user' }
    });
  }
});

/**
 * POST /api/admin/approvals/:userId/disapprove
 */
router.post('/:userId/disapprove', async (req: Request, res: Response) => {
  try {
    const groupId = typeof req.body?.groupId === 'string' ? req.body.groupId : null;
    const comment = typeof req.body?.comment === 'string' ? req.body.comment : '';
    const canManageAll = canManageAllApprovals(req);

    if (!comment.trim()) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'comment is required' }
      });
    }

    if (groupId && !canManageAll) {
      const ok = await requireGroupAdmin(req, res, groupId);
      if (!ok) return;
    }

    if (!groupId && !canManageAll) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Approval access required' }
      });
    }

    const user = await markUserDisapproved(req.params.userId, comment.trim(), req.userId!, getClientIp(req) || undefined);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' }
      });
    }

    return res.json({ success: true, data: user });
  } catch (error) {
    console.error('[Approvals] Error disapproving user:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to disapprove user' }
    });
  }
});

export default router;

