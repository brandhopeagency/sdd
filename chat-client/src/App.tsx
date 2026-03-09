import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { Permission } from './types';

// Pages
import WelcomeScreen from './features/auth/WelcomeScreen';
import LoginPage from './features/auth/LoginPage';
import PendingApprovalPage from './features/auth/PendingApprovalPage';
import ChatInterface from './features/chat/ChatInterface';
import WorkbenchLayout from './features/workbench/WorkbenchLayout';
import WorkbenchHome from './features/workbench/WorkbenchHome';
import UserListView from './features/workbench/users/UserListView';
import UserProfileCard from './features/workbench/users/UserProfileCard';
import ChatHistoryList from './features/workbench/research/ChatHistoryList';
import ModerationView from './features/workbench/research/ModerationView';
import PrivacyDashboard from './features/workbench/privacy/PrivacyDashboard';
import SettingsView from './features/workbench/settings/SettingsView';
import GroupDashboard from './features/workbench/group/GroupDashboard';
import GroupUsersView from './features/workbench/group/GroupUsersView';
import GroupSessionsView from './features/workbench/group/GroupSessionsView';
import GroupConversationView from './features/workbench/group/GroupConversationView';
import GroupsView from './features/workbench/groups/GroupsView';
import ApprovalsView from './features/workbench/approvals/ApprovalsView';

// Protected Route wrapper
function ProtectedRoute({ 
  children, 
  requiredPermission,
  allowPending = false
}: { 
  children: React.ReactNode;
  requiredPermission?: Permission;
  allowPending?: boolean;
}) {
  const { isAuthenticated, user } = useAuthStore();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!allowPending && user?.status === 'pending') {
    return <Navigate to="/pending" replace />;
  }
  
  if (requiredPermission && !user?.permissions.includes(requiredPermission)) {
    return <Navigate to="/chat" replace />;
  }
  
  return <>{children}</>;
}

function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<WelcomeScreen />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/pending"
        element={
          <ProtectedRoute allowPending>
            <PendingApprovalPage />
          </ProtectedRoute>
        }
      />
      
      {/* Chat - requires authentication */}
      <Route 
        path="/chat" 
        element={
          <ProtectedRoute>
            <ChatInterface />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/chat/:sessionId" 
        element={
          <ProtectedRoute>
            <ChatInterface />
          </ProtectedRoute>
        } 
      />
      
      {/* Workbench - requires WORKBENCH_ACCESS */}
      <Route 
        path="/workbench" 
        element={
          <ProtectedRoute requiredPermission={Permission.WORKBENCH_ACCESS}>
            <WorkbenchLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<WorkbenchHome />} />
        
        {/* User Management */}
        <Route path="users" element={<UserListView />} />
        <Route path="users/:userId" element={<UserProfileCard />} />
        <Route
          path="groups"
          element={
            <ProtectedRoute requiredPermission={Permission.WORKBENCH_USER_MANAGEMENT}>
              <GroupsView />
            </ProtectedRoute>
          }
        />
        <Route path="approvals" element={<ApprovalsView />} />

        {/* Group-scoped Workbench */}
        <Route
          path="group"
          element={
            <ProtectedRoute requiredPermission={Permission.WORKBENCH_GROUP_DASHBOARD}>
              <GroupDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="group/users"
          element={
            <ProtectedRoute requiredPermission={Permission.WORKBENCH_GROUP_USERS}>
              <GroupUsersView />
            </ProtectedRoute>
          }
        />
        <Route
          path="group/sessions"
          element={
            <ProtectedRoute requiredPermission={Permission.WORKBENCH_GROUP_RESEARCH}>
              <GroupSessionsView />
            </ProtectedRoute>
          }
        />
        <Route
          path="group/sessions/:sessionId"
          element={
            <ProtectedRoute requiredPermission={Permission.WORKBENCH_GROUP_RESEARCH}>
              <GroupConversationView />
            </ProtectedRoute>
          }
        />
        
        {/* Research & Moderation */}
        <Route path="research" element={<ChatHistoryList />} />
        <Route path="research/session/:sessionId" element={<ModerationView />} />
        
        {/* Privacy */}
        <Route path="privacy" element={<PrivacyDashboard />} />
        
        {/* Settings */}
        <Route path="settings" element={<SettingsView />} />
      </Route>
      
      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;

