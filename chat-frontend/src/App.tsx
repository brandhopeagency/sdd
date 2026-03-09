import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import RouteRecovery from './routes/RouteRecovery';
import { WorkbenchRedirect } from './routes/legacyRedirects';

import WelcomeScreen from './features/auth/WelcomeScreen';
import LoginPage from './features/auth/LoginPage';
import PendingApprovalPage from './features/auth/PendingApprovalPage';
import ChatShell from './features/chat/ChatShell';
import ChatLayout from './features/chat/ChatLayout';

function ProtectedRoute({ 
  children, 
  allowPending = false,
}: { 
  children: React.ReactNode;
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
  
  return <>{children}</>;
}

function App() {
  return (
    <Routes>
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

      <Route
        element={
          <ProtectedRoute>
            <ChatLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/chat" element={<ChatShell />} />
        <Route path="/chat/:sessionId" element={<ChatShell />} />
      </Route>

      {/* Cross-surface redirect: workbench paths -> workbench app */}
      <Route path="/workbench/*" element={<WorkbenchRedirect />} />

      <Route path="*" element={<RouteRecovery />} />
    </Routes>
  );
}

export default App;
