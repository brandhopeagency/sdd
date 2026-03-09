import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'

interface GroupScopeRouteProps {
  children: ReactNode
}

export default function GroupScopeRoute({ children }: GroupScopeRouteProps) {
  const { user, activeGroupId } = useAuthStore()
  const resolvedGroupId = activeGroupId ?? user?.activeGroupId ?? null

  if (!resolvedGroupId) {
    return <Navigate to='/workbench' replace />
  }

  return <>{children}</>
}
