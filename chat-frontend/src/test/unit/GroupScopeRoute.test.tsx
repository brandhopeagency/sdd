/// <reference types="vitest/globals" />
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import GroupScopeRoute from '@/components/GroupScopeRoute'
import { Permission } from '@/types'

const mockUseAuthStore = vi.fn()
vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => mockUseAuthStore(),
}))

const buildUser = (permissions: Permission[]) => ({
  id: 'u1',
  email: 't@example.com',
  displayName: 'Test User',
  role: 'researcher',
  status: 'active',
  permissions,
  groupId: null,
  activeGroupId: null,
  createdAt: new Date(),
  lastLoginAt: new Date(),
})

const renderRouter = (element: React.ReactNode) => {
  const router = createMemoryRouter(
    [
      { path: '/workbench/group', element },
      { path: '/workbench', element: <div>WorkbenchHome</div> },
    ],
    { initialEntries: ['/workbench/group'] },
  )

  render(<RouterProvider router={router} />)
  return router
}

describe('GroupScopeRoute', () => {
  it('redirects to workbench when no active group', async () => {
    mockUseAuthStore.mockReturnValue({
      user: buildUser([Permission.WORKBENCH_GROUP_DASHBOARD]),
      activeGroupId: null,
    })

    const router = renderRouter(
      <GroupScopeRoute>
        <div>GroupDashboard</div>
      </GroupScopeRoute>,
    )

    await waitFor(() => expect(router.state.location.pathname).toBe('/workbench'))
    expect(screen.getByText('WorkbenchHome')).toBeInTheDocument()
  })

  it('allows access when active group exists', async () => {
    mockUseAuthStore.mockReturnValue({
      user: buildUser([Permission.WORKBENCH_GROUP_DASHBOARD]),
      activeGroupId: 'group-1',
    })

    const router = renderRouter(
      <GroupScopeRoute>
        <div>GroupDashboard</div>
      </GroupScopeRoute>,
    )

    await waitFor(() => expect(router.state.location.pathname).toBe('/workbench/group'))
    expect(screen.getByText('GroupDashboard')).toBeInTheDocument()
  })
})
