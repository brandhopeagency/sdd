import { Router, Request, Response } from 'express';
import { authenticate, requireActiveAccount, getClientIp, requirePermission } from '../middleware/auth';
import { Permission, UserRole } from '../types';
import {
  createGroup,
  updateGroup,
  listGroups,
  listGroupMemberships,
  addUserToGroup,
  removeUserFromGroup,
  setGroupMembershipRole,
  listInvitationCodes,
  createInvitationCode,
  deactivateInvitationCode,
  findUserIdByEmail
} from '../services/group.service';
import { query } from '../db';
import { logAuditEvent } from '../services/auth.service';

const router = Router();

router.use(authenticate);
router.use(requireActiveAccount);
router.use(requirePermission(Permission.WORKBENCH_USER_MANAGEMENT));

function requireGroupManager(req: Request, res: Response): boolean {
  if (![UserRole.OWNER, UserRole.MODERATOR].includes(req.user?.role as any)) {
    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Only system admins can manage groups' }
    });
    return false;
  }
  return true;
}
/**
 * GET /api/admin/groups
 * List all groups (Owner-only).
 */
router.get('/', async (req: Request, res: Response) => {
  if (!requireGroupManager(req, res)) return;
  try {
    const groups = await listGroups();
    return res.json({ success: true, data: groups });
  } catch (error) {
    console.error('[Admin Groups] Error listing groups:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to list groups' }
    });
  }
});

/**
 * POST /api/admin/groups
 * Create a group (Owner-only).
 */
router.post('/', async (req: Request, res: Response) => {
  if (!requireGroupManager(req, res)) return;
  try {
    const name = req.body?.name;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'name is required' }
      });
    }

    const group = await createGroup({ name }, req.userId!, getClientIp(req) || undefined);
    return res.status(201).json({ success: true, data: group });
  } catch (error: any) {
    if (error?.message === 'INVALID_GROUP_NAME') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'Invalid group name' }
      });
    }
    console.error('[Admin Groups] Error creating group:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create group' }
    });
  }
});

/**
 * POST /api/admin/groups/:groupId/archive
 * Archive a group (Owner + Moderator).
 */
router.post('/:groupId/archive', async (req: Request, res: Response) => {
  if (!requireGroupManager(req, res)) return;
  try {
    const groupId = req.params.groupId;
    const result = await query(
      `UPDATE groups SET archived_at = NOW(), archived_by = $2 WHERE id = $1 AND archived_at IS NULL RETURNING id, name, archived_at`,
      [groupId, req.userId!]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Group not found or already archived' }
      });
    }

    await logAuditEvent(req.userId!, 'group.archive', 'group', groupId, {}, getClientIp(req));
    return res.json({ success: true, data: { groupId } });
  } catch (error) {
    console.error('[Admin Groups] Error archiving group:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to archive group' }
    });
  }
});

/**
 * PATCH /api/admin/groups/:groupId
 * Update group name.
 */
router.patch('/:groupId', async (req: Request, res: Response) => {
  if (!requireGroupManager(req, res)) return;
  try {
    const name = req.body?.name;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'name is required' }
      });
    }

    const group = await updateGroup(req.params.groupId, { name }, req.userId!, getClientIp(req) || undefined);
    if (!group) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Group not found' }
      });
    }
    return res.json({ success: true, data: group });
  } catch (error: any) {
    if (error?.message === 'INVALID_GROUP_NAME') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'Invalid group name' }
      });
    }
    console.error('[Admin Groups] Error updating group:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update group' }
    });
  }
});

/**
 * POST /api/admin/groups/:groupId/unarchive
 * Unarchive a group (Owner + Moderator).
 */
router.post('/:groupId/unarchive', async (req: Request, res: Response) => {
  if (!requireGroupManager(req, res)) return;
  try {
    const groupId = req.params.groupId;
    const result = await query(
      `UPDATE groups SET archived_at = NULL, archived_by = NULL WHERE id = $1 AND archived_at IS NOT NULL RETURNING id`,
      [groupId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Group not found or not archived' }
      });
    }

    await logAuditEvent(req.userId!, 'group.unarchive', 'group', groupId, {}, getClientIp(req));
    return res.json({ success: true, data: { groupId } });
  } catch (error) {
    console.error('[Admin Groups] Error unarchiving group:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to unarchive group' }
    });
  }
});

/**
 * GET /api/admin/groups/:groupId/members
 * List members + roles in a group.
 */
router.get('/:groupId/members', async (req: Request, res: Response) => {
  try {
    const result = await listGroupMemberships(req.params.groupId, {
      page: parseInt(req.query.page as string) || 1,
      limit: Math.min(parseInt(req.query.limit as string) || 10, 100),
      search: (req.query.search as string) || '',
      role: (req.query.role as any) || 'all',
      status: (req.query.status as any) || 'all',
      sortBy: (req.query.sortBy as string) || 'created_at',
      sortOrder: (req.query.sortOrder as any) || 'desc'
    });

    return res.json({
      success: true,
      data: result.members,
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        hasMore: result.hasMore
      }
    });
  } catch (error) {
    console.error('[Admin Groups] Error listing members:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to list group members' }
    });
  }
});

/**
 * POST /api/admin/groups/:groupId/members
 * Add a user to a group.
 */
router.post('/:groupId/members', async (req: Request, res: Response) => {
  try {
    const userIdRaw = req.body?.userId;
    const emailRaw = req.body?.email;

    let userId: string | null =
      typeof userIdRaw === 'string' && userIdRaw.trim() ? userIdRaw.trim() : null;
    const email: string | null =
      typeof emailRaw === 'string' && emailRaw.trim() ? emailRaw.trim() : null;

    if (!userId && email) {
      userId = await findUserIdByEmail(email);
    }

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'Provide userId or email' }
      });
    }

    const user = await addUserToGroup(
      { groupId: req.params.groupId, userId },
      req.userId!,
      getClientIp(req) || undefined
    );
    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' }
      });
    }

    return res.status(201).json({ success: true, data: user });
  } catch (error: any) {
    if (error?.message === 'FORBIDDEN_TARGET_ROLE') {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Cannot change group membership for privileged roles' }
      });
    }
    console.error('[Admin Groups] Error adding member:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to add group member' }
    });
  }
});

/**
 * PATCH /api/admin/groups/:groupId/members/:userId
 * Update membership role.
 */
router.patch('/:groupId/members/:userId', async (req: Request, res: Response) => {
  try {
    const role = req.body?.role;
    if (!role || !['member', 'admin'].includes(role)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'role must be member or admin' }
      });
    }

    const ok = await setGroupMembershipRole(
      { groupId: req.params.groupId, userId: req.params.userId, role },
      req.userId!,
      getClientIp(req) || undefined
    );
    if (!ok) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Membership not found' }
      });
    }

    return res.json({ success: true, data: { ok: true } });
  } catch (error) {
    console.error('[Admin Groups] Error updating member role:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update member role' }
    });
  }
});

/**
 * DELETE /api/admin/groups/:groupId/members/:userId
 * Remove a user from a group.
 */
router.delete('/:groupId/members/:userId', async (req: Request, res: Response) => {
  try {
    const user = await removeUserFromGroup(
      { groupId: req.params.groupId, userId: req.params.userId },
      req.userId!,
      getClientIp(req) || undefined
    );
    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Membership not found' }
      });
    }

    return res.json({ success: true, data: user });
  } catch (error) {
    console.error('[Admin Groups] Error removing member:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to remove group member' }
    });
  }
});

/**
 * GET /api/admin/groups/:groupId/invites
 */
router.get('/:groupId/invites', async (req: Request, res: Response) => {
  try {
    const invites = await listInvitationCodes(req.params.groupId);
    return res.json({ success: true, data: invites });
  } catch (error) {
    console.error('[Admin Groups] Error listing invites:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to list invitation codes' }
    });
  }
});

/**
 * POST /api/admin/groups/:groupId/invites
 */
router.post('/:groupId/invites', async (req: Request, res: Response) => {
  try {
    const code = typeof req.body?.code === 'string' ? req.body.code : undefined;
    const expiresAt = typeof req.body?.expiresAt === 'string' ? req.body.expiresAt : undefined;

    const invite = await createInvitationCode(
      { groupId: req.params.groupId, code, expiresAt },
      req.userId!,
      getClientIp(req) || undefined
    );
    return res.status(201).json({ success: true, data: invite });
  } catch (error: any) {
    if (error?.message === 'INVALID_INVITATION_CODE') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'Invitation code must be alphanumeric' }
      });
    }
    if (error?.message === 'INVALID_EXPIRES_AT') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'expiresAt must be an ISO date string' }
      });
    }
    console.error('[Admin Groups] Error creating invite:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create invitation code' }
    });
  }
});

/**
 * POST /api/admin/groups/:groupId/invites/:codeId/deactivate
 */
router.post('/:groupId/invites/:codeId/deactivate', async (req: Request, res: Response) => {
  try {
    const invite = await deactivateInvitationCode(
      { groupId: req.params.groupId, codeId: req.params.codeId },
      req.userId!,
      getClientIp(req) || undefined
    );
    if (!invite) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Invitation code not found' }
      });
    }
    return res.json({ success: true, data: invite });
  } catch (error) {
    console.error('[Admin Groups] Error deactivating invite:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to deactivate invitation code' }
    });
  }
});

export default router;

