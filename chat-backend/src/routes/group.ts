import { Router, Request, Response } from 'express';
import { authenticate, requireActiveAccount, requirePermission, getClientIp } from '../middleware/auth';
import { Permission, UserRole } from '../types';
import { maskPIIInUnknown } from '../utils/piiMasking';
import {
  getGroupById,
  getGroupStats,
  listGroupUsers,
  addUserToGroup,
  removeUserFromGroup,
  findUserIdByEmail,
  getMembershipForUser,
  createAndAddUserToGroup,
  checkEmailExists
} from '../services/group.service';
import {
  approveGroupRequest,
  createInviteCode,
  listPendingGroupRequests,
  rejectGroupRequest,
  setActiveGroup
} from '../services/groupMembership.service';
import { getGroupSessionById, getGroupSessionConversation, listGroupSessions } from '../services/groupSessions.service';

const router = Router();

router.use(authenticate);
router.use(requireActiveAccount);

function resolveGroupId(req: Request, res: Response): string | null {
  const headerValue = typeof req.headers['x-group-id'] === 'string' ? req.headers['x-group-id'] : null;
  const queryValue = typeof req.query.groupId === 'string' ? req.query.groupId : null;
  const groupId = queryValue || headerValue;
  if (!groupId) {
    res.status(400).json({
      success: false,
      error: { code: 'GROUP_ID_REQUIRED', message: 'groupId is required' }
    });
    return null;
  }
  return groupId;
}

async function requireGroupAdmin(req: Request, res: Response): Promise<string | null> {
  const groupId = resolveGroupId(req, res);
  if (!groupId) return null;
  if (req.user?.role === UserRole.OWNER) return groupId;
  if (!req.userId) return null;

  const membership = await getMembershipForUser(req.userId, groupId);
  if (!membership || membership.status !== 'active' || membership.role !== 'admin') {
    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Group admin access required' }
    });
    return null;
  }
  return groupId;
}

function stripSystemPrompts<T>(value: T): T {
  // Best-effort: remove systemPrompts blocks entirely to reduce risk of leaking sensitive context.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const v: any = value;
  if (v === null || v === undefined) return value;
  if (typeof v === 'string') return value;
  if (Array.isArray(v)) return v.map(stripSystemPrompts) as unknown as T;
  if (typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v)) {
      if (k === 'systemPrompts') continue;
      out[k] = stripSystemPrompts(val);
    }
    return out as unknown as T;
  }
  return value;
}

/**
 * GET /api/group/me
 * Returns group context for the current user.
 */
router.get('/me', requirePermission(Permission.WORKBENCH_GROUP_DASHBOARD), async (req: Request, res: Response) => {
  const groupId = await requireGroupAdmin(req, res);
  if (!groupId) return;

  const group = await getGroupById(groupId);
  return res.json({
    success: true,
    data: {
      groupId,
      group
    }
  });
});

/**
 * GET /api/group/dashboard
 * Group-scoped dashboard stats.
 */
router.get(
  '/dashboard',
  requirePermission(Permission.WORKBENCH_GROUP_DASHBOARD),
  async (req: Request, res: Response) => {
    try {
      const groupId = await requireGroupAdmin(req, res);
      if (!groupId) return;

      const [group, stats] = await Promise.all([getGroupById(groupId), getGroupStats(groupId)]);
      return res.json({ success: true, data: { group, stats } });
    } catch (error) {
      console.error('[Group] Error getting dashboard:', error);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to load group dashboard' }
      });
    }
  }
);

/**
 * GET /api/group/users
 * List users in current group.
 */
router.get('/users', requirePermission(Permission.WORKBENCH_GROUP_USERS), async (req: Request, res: Response) => {
  try {
    const groupId = await requireGroupAdmin(req, res);
    if (!groupId) return;

    const result = await listGroupUsers(groupId, {
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
      data: result.users,
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        hasMore: result.hasMore
      }
    });
  } catch (error) {
    console.error('[Group] Error listing group users:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to list group users' }
    });
  }
});

/**
 * POST /api/group/active
 * Set active group context for current user.
 *
 * Body: { groupId: string }
 */
router.post('/active', async (req: Request, res: Response) => {
  try {
    const groupId = typeof req.body?.groupId === 'string' ? req.body.groupId.trim() : '';
    if (!groupId) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'groupId is required' }
      });
    }

    const allowWithoutMembership = req.user?.permissions?.includes(Permission.WORKBENCH_USER_MANAGEMENT) ?? false;
    const updated = await setActiveGroup(req.userId!, groupId, req.userId!, {
      allowWithoutMembership,
      ipAddress: getClientIp(req) || undefined
    });
    return res.json({ success: true, data: updated });
  } catch (error: any) {
    if (error?.message === 'NO_ACTIVE_MEMBERSHIP') {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You are not an active member of this group' }
      });
    }
    console.error('[Group] Error setting active group:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to set active group' }
    });
  }
});

/**
 * POST /api/group/invites
 * Create an invite code for the current group (group-admin only).
 */
router.post('/invites', requirePermission(Permission.WORKBENCH_GROUP_USERS), async (req: Request, res: Response) => {
  try {
    const groupId = await requireGroupAdmin(req, res);
    if (!groupId) return;

    const maxUses = req.body?.maxUses;
    const expiresAt = req.body?.expiresAt ?? null;
    const requiresApproval = typeof req.body?.requiresApproval === 'boolean' ? req.body.requiresApproval : undefined;
    const invite = await createInviteCode(
      { groupId, maxUses: typeof maxUses === 'number' ? maxUses : undefined, expiresAt: typeof expiresAt === 'string' ? expiresAt : null, requiresApproval },
      req.userId!,
      getClientIp(req) || undefined
    );
    return res.status(201).json({ success: true, data: invite });
  } catch (error: any) {
    if (error?.message === 'INVALID_EXPIRES_AT') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'expiresAt must be an ISO date string' }
      });
    }
    console.error('[Group] Error creating invite:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create invite code' }
    });
  }
});

/**
 * GET /api/group/requests
 * List pending membership requests for the current group (group-admin only).
 */
router.get('/requests', requirePermission(Permission.WORKBENCH_GROUP_USERS), async (req: Request, res: Response) => {
  try {
    const groupId = await requireGroupAdmin(req, res);
    if (!groupId) return;

    const requests = await listPendingGroupRequests(groupId);
    return res.json({ success: true, data: requests });
  } catch (error) {
    console.error('[Group] Error listing requests:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to list membership requests' }
    });
  }
});

/**
 * POST /api/group/requests/:userId/approve
 * Approve pending membership request (group-admin only).
 */
router.post(
  '/requests/:userId/approve',
  requirePermission(Permission.WORKBENCH_GROUP_USERS),
  async (req: Request, res: Response) => {
    try {
      const groupId = await requireGroupAdmin(req, res);
      if (!groupId) return;

      await approveGroupRequest({ groupId, userId: req.params.userId }, req.userId!, getClientIp(req) || undefined);
      return res.json({ success: true, data: { ok: true } });
    } catch (error: any) {
      if (error?.message === 'REQUEST_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Request not found' }
        });
      }
      if (error?.message === 'INVITE_NOT_AVAILABLE') {
        return res.status(409).json({
          success: false,
          error: { code: 'INVITE_NOT_AVAILABLE', message: 'Invite code is no longer available' }
        });
      }
      console.error('[Group] Error approving request:', error);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to approve request' }
      });
    }
  }
);

/**
 * POST /api/group/requests/:userId/reject
 * Reject pending membership request (group-admin only).
 */
router.post(
  '/requests/:userId/reject',
  requirePermission(Permission.WORKBENCH_GROUP_USERS),
  async (req: Request, res: Response) => {
    try {
      const groupId = await requireGroupAdmin(req, res);
      if (!groupId) return;

      await rejectGroupRequest({ groupId, userId: req.params.userId }, req.userId!, getClientIp(req) || undefined);
      return res.json({ success: true, data: { ok: true } });
    } catch (error: any) {
      if (error?.message === 'REQUEST_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Request not found' }
        });
      }
      console.error('[Group] Error rejecting request:', error);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to reject request' }
      });
    }
  }
);

/**
 * GET /api/group/users/check-email
 * Pre-flight check: does a user with this email already exist?
 */
router.get('/users/check-email', requirePermission(Permission.WORKBENCH_GROUP_USERS), async (req: Request, res: Response) => {
  try {
    const groupId = await requireGroupAdmin(req, res);
    if (!groupId) return;

    const email = typeof req.query.email === 'string' ? req.query.email.trim() : '';
    if (!email) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'email query parameter is required' }
      });
    }

    const result = await checkEmailExists(email);
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('[Group] Error checking email:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to check email' }
    });
  }
});

/**
 * POST /api/group/users
 * Add a user to the current group.
 *
 * For existing users: { userId?: string; email?: string }
 * For new users:      { email: string; displayName: string; role?: string; createNew: true }
 */
router.post('/users', requirePermission(Permission.WORKBENCH_GROUP_USERS), async (req: Request, res: Response) => {
  try {
    const groupId = await requireGroupAdmin(req, res);
    if (!groupId) return;

    const createNew = req.body?.createNew === true;

    if (createNew) {
      const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
      const displayName = typeof req.body?.displayName === 'string' ? req.body.displayName.trim() : '';
      const role = typeof req.body?.role === 'string' ? req.body.role : undefined;

      if (!email || !displayName) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_REQUEST', message: 'email and displayName are required for new user creation' }
        });
      }

      const newUser = await createAndAddUserToGroup(
        { groupId, email, displayName, role },
        req.userId!,
        getClientIp(req) || undefined
      );
      return res.status(201).json({ success: true, data: newUser });
    }

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

    const updated = await addUserToGroup({ groupId, userId }, req.userId!, getClientIp(req) || undefined);
    if (!updated) {
      return res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' }
      });
    }

    return res.status(201).json({ success: true, data: updated });
  } catch (error) {
    if ((error as any)?.message === 'FORBIDDEN_TARGET_ROLE') {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Cannot change group membership for privileged roles' }
      });
    }
    if ((error as any)?.message === 'USER_IN_OTHER_GROUP') {
      return res.status(409).json({
        success: false,
        error: { code: 'CONFLICT', message: 'User is already assigned to a different group' }
      });
    }
    if ((error as any)?.message === 'EMAIL_ALREADY_EXISTS') {
      return res.status(409).json({
        success: false,
        error: { code: 'EMAIL_ALREADY_EXISTS', message: 'A user with this email already exists' }
      });
    }
    console.error('[Group] Error adding user to group:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to add user to group' }
    });
  }
});

/**
 * DELETE /api/group/users/:userId
 * Remove a user from current group.
 */
router.delete(
  '/users/:userId',
  requirePermission(Permission.WORKBENCH_GROUP_USERS),
  async (req: Request, res: Response) => {
    try {
      const groupId = await requireGroupAdmin(req, res);
      if (!groupId) return;

      const updated = await removeUserFromGroup(
        { groupId, userId: req.params.userId },
        req.userId!,
        getClientIp(req) || undefined
      );
      if (!updated) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'User not found in this group' }
        });
      }

      return res.json({ success: true, data: updated });
    } catch (error) {
      console.error('[Group] Error removing user from group:', error);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to remove user from group' }
      });
    }
  }
);

/**
 * GET /api/group/sessions
 * List sessions scoped to current group.
 */
router.get('/sessions', requirePermission(Permission.WORKBENCH_GROUP_RESEARCH), async (req: Request, res: Response) => {
  try {
    const groupId = await requireGroupAdmin(req, res);
    if (!groupId) return;

    const pageRaw = parseInt(req.query.page as string);
    const limitRaw = parseInt(req.query.limit as string);
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 20;
    const search = (req.query.search as string) || '';
    const statusRaw = (req.query.status as string) || 'all';
    const moderationStatusRaw = (req.query.moderationStatus as string) || 'all';
    const dateFromRaw = (req.query.dateFrom as string) || undefined;
    const dateToRaw = (req.query.dateTo as string) || undefined;

    const statusAllowed = ['active', 'ended', 'expired', 'all'] as const;
    const moderationAllowed = ['pending', 'in_review', 'moderated', 'all'] as const;

    const status = (statusAllowed as readonly string[]).includes(statusRaw) ? (statusRaw as any) : 'all';
    const moderationStatus = (moderationAllowed as readonly string[]).includes(moderationStatusRaw)
      ? (moderationStatusRaw as any)
      : 'all';

    const result = await listGroupSessions(groupId, {
      page,
      limit,
      search,
      status,
      moderationStatus,
      dateFrom: dateFromRaw,
      dateTo: dateToRaw
    });

    return res.json({
      success: true,
      data: result.sessions.map((s) => ({
        ...s,
        userId: null,
        tags: [],
        userName: null // Always anonymized for group admins
      })),
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        hasMore: result.hasMore
      }
    });
  } catch (error) {
    console.error('[Group] Error listing group sessions:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to list group sessions' }
    });
  }
});

/**
 * GET /api/group/sessions/:id
 * Group-scoped session metadata.
 */
router.get('/sessions/:id', requirePermission(Permission.WORKBENCH_GROUP_RESEARCH), async (req: Request, res: Response) => {
  try {
    const groupId = await requireGroupAdmin(req, res);
    if (!groupId) return;

    const session = await getGroupSessionById(groupId, req.params.id);
    if (!session) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Session not found' } });
    }

    return res.json({ success: true, data: { ...session, userId: null, tags: [], userName: null } });
  } catch (error) {
    console.error('[Group] Error getting group session:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get group session' }
    });
  }
});

/**
 * GET /api/group/sessions/:id/conversation
 * Group-scoped conversation (always anonymized + without system prompts).
 */
router.get(
  '/sessions/:id/conversation',
  requirePermission(Permission.WORKBENCH_GROUP_RESEARCH),
  async (req: Request, res: Response) => {
    try {
      const groupId = await requireGroupAdmin(req, res);
      if (!groupId) return;

      const conversation = await getGroupSessionConversation(groupId, req.params.id);
      if (!conversation) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Conversation not found' }
        });
      }

      const data = maskPIIInUnknown(stripSystemPrompts(conversation));
      return res.json({ success: true, data });
    } catch (error) {
      console.error('[Group] Error getting group conversation:', error);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get conversation' }
      });
    }
  }
);

export default router;

