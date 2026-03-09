import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@mentalhelpglobal/chat-frontend-common';
import { Permission } from '@mentalhelpglobal/chat-types';
import {
  LoginPage,
  WelcomeScreen,
  PendingApprovalPage,
} from '@mentalhelpglobal/chat-frontend-common';
import RouteRecovery from './routes/RouteRecovery';
import { ChatRedirect } from './routes/legacyRedirects';

import WorkbenchShell from './features/workbench/WorkbenchShell';
import WorkbenchAccessDenied from './features/workbench/WorkbenchAccessDenied';

function ProtectedRoute({
  children,
  requiredPermission,
  allowPending = false,
  accessDeniedElement,
}: {
  children: React.ReactNode;
  requiredPermission?: Permission;
  allowPending?: boolean;
  accessDeniedElement?: React.ReactNode;
}) {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!allowPending && user?.status === 'pending') {
    return <Navigate to="/pending" replace />;
  }

  if (requiredPermission && !user?.permissions.includes(requiredPermission)) {
    if (accessDeniedElement) return <>{accessDeniedElement}</>;
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      {/* Auth routes */}
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

      {/* Workbench routes */}
      <Route
        path="/workbench/*"
        element={
          <ProtectedRoute
            requiredPermission={Permission.WORKBENCH_ACCESS}
            accessDeniedElement={<WorkbenchAccessDenied />}
          >
            <WorkbenchShell />
          </ProtectedRoute>
        }
      />

      {/* Cross-surface redirect: chat paths → chat app */}
      <Route path="/chat/*" element={<ChatRedirect />} />
      <Route path="/chat" element={<ChatRedirect />} />

      {/* 404 fallback */}
      <Route path="*" element={<RouteRecovery />} />
    </Routes>
  );
}
