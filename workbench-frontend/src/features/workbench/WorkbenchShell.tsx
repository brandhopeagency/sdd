/**
 * Workbench surface shell — renders workbench-specific routes.
 *
 * Top-level WORKBENCH_ACCESS is enforced in App.tsx via ProtectedRoute.
 * Sub-route permissions are applied here per-route.
 */

import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import { useAuthStore, GroupScopeRoute } from '@mentalhelpglobal/chat-frontend-common';
import { Permission } from '@mentalhelpglobal/chat-types';

// Layout
import WorkbenchLayout from './WorkbenchLayout';
import WorkbenchHome from './WorkbenchHome';

// User Management
import UserListView from './users/UserListView';
import UserProfileCard from './users/UserProfileCard';
import GroupsView from './groups/GroupsView';
import ApprovalsView from './approvals/ApprovalsView';

// Group-scoped
import GroupDashboard from './group/GroupDashboard';
import GroupUsersView from './group/GroupUsersView';
import GroupSessionsView from './group/GroupSessionsView';
import GroupConversationView from './group/GroupConversationView';

// Research & Moderation
import ChatHistoryList from './research/ChatHistoryList';
import ModerationView from './research/ModerationView';

// Privacy
import PrivacyDashboard from './privacy/PrivacyDashboard';

// Settings
import SettingsView from './settings/SettingsView';

// Review system
import ReviewQueueView from './review/ReviewQueueView';
import ReviewSessionView from './review/ReviewSessionView';
import ReviewDashboard from './review/ReviewDashboard';
import TeamDashboard from './review/TeamDashboard';
import EscalationQueue from './review/EscalationQueue';
import DeanonymizationPanel from './review/DeanonymizationPanel';
import ReviewConfigPage from './review/ReviewConfigPage';
import TagManagementPage from './review/TagManagementPage';
import ReportView from './review/ReportView';
import SupervisorReviewView from './review/SupervisorReviewView';
import ReviewErrorBoundary from './review/ReviewErrorBoundary';

// Survey Module
import SurveySchemaListView from './surveys/SurveySchemaListView';
import SurveySchemaEditorView from './surveys/SurveySchemaEditorView';
import SurveyInstanceListView from './surveys/SurveyInstanceListView';
import SurveyInstanceDetailView from './surveys/SurveyInstanceDetailView';
import SurveyResponseListView from './surveys/SurveyResponseListView';
import GroupSurveysPage from './groups/GroupSurveysPage';

/**
 * Inline ProtectedRoute for sub-route permission checks.
 * Mirrors the shape used in App.tsx, but scoped to workbench nested routes.
 */
function SubRouteGuard({
  children,
  requiredPermission,
  anyPermissions,
}: {
  children: React.ReactNode;
  requiredPermission?: Permission;
  anyPermissions?: Permission[];
}) {
  const { user } = useAuthStore();

  if (requiredPermission && !user?.permissions.includes(requiredPermission)) {
    return <Navigate to="/workbench" replace />;
  }

  if (anyPermissions && !anyPermissions.some((perm) => user?.permissions.includes(perm))) {
    return <Navigate to="/workbench" replace />;
  }

  return <>{children}</>;
}

function ResearchSessionRedirect() {
  const { sessionId } = useParams();
  return <Navigate to={sessionId ? `/workbench/review/session/${sessionId}` : '/workbench/review'} replace />;
}

export default function WorkbenchShell() {
  return (
    <Routes>
      <Route path="/" element={<WorkbenchLayout />}>
        <Route index element={<WorkbenchHome />} />

        {/* User Management */}
        <Route
          path="users"
          element={
            <SubRouteGuard requiredPermission={Permission.WORKBENCH_USER_MANAGEMENT}>
              <UserListView />
            </SubRouteGuard>
          }
        />
        <Route
          path="users/:userId"
          element={
            <SubRouteGuard requiredPermission={Permission.WORKBENCH_USER_MANAGEMENT}>
              <UserProfileCard />
            </SubRouteGuard>
          }
        />
        <Route
          path="groups"
          element={
            <SubRouteGuard requiredPermission={Permission.WORKBENCH_USER_MANAGEMENT}>
              <GroupsView />
            </SubRouteGuard>
          }
        />
        <Route
          path="approvals"
          element={
            <SubRouteGuard requiredPermission={Permission.WORKBENCH_USER_MANAGEMENT}>
              <ApprovalsView />
            </SubRouteGuard>
          }
        />

        {/* Group-scoped Workbench */}
        <Route
          path="group"
          element={
            <SubRouteGuard requiredPermission={Permission.WORKBENCH_GROUP_DASHBOARD}>
              <GroupScopeRoute>
                <GroupDashboard />
              </GroupScopeRoute>
            </SubRouteGuard>
          }
        />
        <Route
          path="group/users"
          element={
            <SubRouteGuard requiredPermission={Permission.WORKBENCH_GROUP_USERS}>
              <GroupScopeRoute>
                <GroupUsersView />
              </GroupScopeRoute>
            </SubRouteGuard>
          }
        />
        <Route
          path="group/sessions"
          element={
            <SubRouteGuard
              anyPermissions={[Permission.WORKBENCH_GROUP_RESEARCH, Permission.WORKBENCH_USER_MANAGEMENT]}
            >
              <GroupScopeRoute>
                <GroupSessionsView />
              </GroupScopeRoute>
            </SubRouteGuard>
          }
        />
        <Route
          path="group/sessions/:sessionId"
          element={
            <SubRouteGuard
              anyPermissions={[Permission.WORKBENCH_GROUP_RESEARCH, Permission.WORKBENCH_USER_MANAGEMENT]}
            >
              <GroupScopeRoute>
                <GroupConversationView />
              </GroupScopeRoute>
            </SubRouteGuard>
          }
        />

        {/* Research & Moderation */}
        <Route
          path="research"
          element={
            <SubRouteGuard requiredPermission={Permission.REVIEW_ACCESS}>
              <Navigate to="/workbench/review" replace />
            </SubRouteGuard>
          }
        />
        <Route
          path="research/session/:sessionId"
          element={
            <SubRouteGuard requiredPermission={Permission.REVIEW_ACCESS}>
              <ResearchSessionRedirect />
            </SubRouteGuard>
          }
        />
        <Route
          path="research-legacy"
          element={
            <SubRouteGuard requiredPermission={Permission.WORKBENCH_RESEARCH}>
              <ChatHistoryList />
            </SubRouteGuard>
          }
        />
        <Route
          path="research-legacy/session/:sessionId"
          element={
            <SubRouteGuard requiredPermission={Permission.WORKBENCH_MODERATION}>
              <ModerationView />
            </SubRouteGuard>
          }
        />

        {/* Privacy */}
        <Route
          path="privacy"
          element={
            <SubRouteGuard requiredPermission={Permission.WORKBENCH_PRIVACY}>
              <PrivacyDashboard />
            </SubRouteGuard>
          }
        />

        {/* Review System */}
        <Route
          path="review"
          element={
            <SubRouteGuard requiredPermission={Permission.REVIEW_ACCESS}>
              <ReviewErrorBoundary>
                <ReviewQueueView />
              </ReviewErrorBoundary>
            </SubRouteGuard>
          }
        />
        <Route
          path="review/session/:sessionId"
          element={
            <SubRouteGuard requiredPermission={Permission.REVIEW_ACCESS}>
              <ReviewErrorBoundary>
                <ReviewSessionView />
              </ReviewErrorBoundary>
            </SubRouteGuard>
          }
        />
        <Route
          path="review/dashboard"
          element={
            <SubRouteGuard requiredPermission={Permission.REVIEW_ACCESS}>
              <ReviewErrorBoundary>
                <ReviewDashboard />
              </ReviewErrorBoundary>
            </SubRouteGuard>
          }
        />
        <Route
          path="review/team"
          element={
            <SubRouteGuard requiredPermission={Permission.REVIEW_TEAM_DASHBOARD}>
              <ReviewErrorBoundary>
                <TeamDashboard />
              </ReviewErrorBoundary>
            </SubRouteGuard>
          }
        />
        <Route
          path="review/escalations"
          element={
            <SubRouteGuard requiredPermission={Permission.REVIEW_ESCALATION}>
              <ReviewErrorBoundary>
                <EscalationQueue />
              </ReviewErrorBoundary>
            </SubRouteGuard>
          }
        />
        <Route
          path="review/deanonymization"
          element={
            <SubRouteGuard requiredPermission={Permission.REVIEW_DEANONYMIZE_APPROVE}>
              <ReviewErrorBoundary>
                <DeanonymizationPanel />
              </ReviewErrorBoundary>
            </SubRouteGuard>
          }
        />
        <Route
          path="review/config"
          element={
            <SubRouteGuard requiredPermission={Permission.REVIEW_CONFIGURE}>
              <ReviewErrorBoundary>
                <ReviewConfigPage />
              </ReviewErrorBoundary>
            </SubRouteGuard>
          }
        />
        <Route
          path="review/tags"
          element={
            <SubRouteGuard requiredPermission={Permission.TAG_MANAGE}>
              <ReviewErrorBoundary>
                <TagManagementPage />
              </ReviewErrorBoundary>
            </SubRouteGuard>
          }
        />
        <Route
          path="review/reports"
          element={
            <SubRouteGuard requiredPermission={Permission.REVIEW_REPORTS}>
              <ReviewErrorBoundary>
                <ReportView />
              </ReviewErrorBoundary>
            </SubRouteGuard>
          }
        />
        <Route
          path="review/supervision/:sessionReviewId"
          element={
            <SubRouteGuard requiredPermission={Permission.REVIEW_SUPERVISE}>
              <ReviewErrorBoundary>
                <SupervisorReviewView />
              </ReviewErrorBoundary>
            </SubRouteGuard>
          }
        />

        {/* Survey Module */}
        <Route path="surveys/schemas" element={<SubRouteGuard requiredPermission={Permission.SURVEY_SCHEMA_MANAGE}><SurveySchemaListView /></SubRouteGuard>} />
        <Route path="surveys/schemas/:id/edit" element={<SubRouteGuard requiredPermission={Permission.SURVEY_SCHEMA_MANAGE}><SurveySchemaEditorView /></SubRouteGuard>} />
        <Route path="surveys/instances" element={<SubRouteGuard anyPermissions={[Permission.SURVEY_INSTANCE_MANAGE, Permission.SURVEY_INSTANCE_VIEW]}><SurveyInstanceListView /></SubRouteGuard>} />
        <Route path="surveys/instances/:id" element={<SubRouteGuard anyPermissions={[Permission.SURVEY_INSTANCE_MANAGE, Permission.SURVEY_INSTANCE_VIEW]}><SurveyInstanceDetailView /></SubRouteGuard>} />
        <Route path="surveys/instances/:id/responses" element={<SubRouteGuard requiredPermission={Permission.SURVEY_RESPONSE_VIEW}><SurveyResponseListView /></SubRouteGuard>} />
        <Route path="groups/:groupId/surveys" element={<SubRouteGuard requiredPermission={Permission.SURVEY_INSTANCE_MANAGE}><GroupSurveysPage /></SubRouteGuard>} />

        {/* Settings */}
        <Route path="settings" element={<SettingsView />} />
      </Route>

      {/* Fallback for unknown workbench sub-routes */}
      <Route path="*" element={<Navigate to="/workbench" replace />} />
    </Routes>
  );
}
