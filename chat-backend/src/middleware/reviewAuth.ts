import { authenticate, requireActiveAccount, requirePermission } from './auth';
import { Permission } from '../types';

// Middleware stack for review routes: authenticate + active account
export const reviewAuth = [authenticate, requireActiveAccount];

// Permission middleware factories for review routes
export const requireReviewAccess = requirePermission(Permission.REVIEW_ACCESS);
export const requireReviewSubmit = requirePermission(Permission.REVIEW_SUBMIT);
export const requireReviewFlag = requirePermission(Permission.REVIEW_FLAG);
export const requireReviewEscalation = requirePermission(Permission.REVIEW_ESCALATION);
export const requireReviewAssign = requirePermission(Permission.REVIEW_ASSIGN);
export const requireReviewConfigure = requirePermission(Permission.REVIEW_CONFIGURE);
export const requireReviewDeanonymizeRequest = requirePermission(Permission.REVIEW_DEANONYMIZE_REQUEST);
export const requireReviewDeanonymizeApprove = requirePermission(Permission.REVIEW_DEANONYMIZE_APPROVE);
export const requireReviewReports = requirePermission(Permission.REVIEW_REPORTS);
export const requireReviewTeamDashboard = requirePermission(Permission.REVIEW_TEAM_DASHBOARD);

// Supervision permission middleware
export const requireReviewSupervise = requirePermission(Permission.REVIEW_SUPERVISE);
export const requireReviewSupervisionConfig = requirePermission(Permission.REVIEW_SUPERVISION_CONFIG);

// Tag permission middleware
export const requireTagManage = requirePermission(Permission.TAG_MANAGE);
export const requireTagCreate = requirePermission(Permission.TAG_CREATE);
export const requireTagAssignUser = requirePermission(Permission.TAG_ASSIGN_USER);
export const requireTagAssignSession = requirePermission(Permission.TAG_ASSIGN_SESSION);
