import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

async function renderWorkbenchHome(user: { permissions: string[]; memberships?: Array<{ status: string }> }) {
  vi.resetModules()

  vi.doMock('@/stores/authStore', () => ({
    useAuthStore: () => ({ user }),
  }))

  vi.doMock('@/features/workbench/Dashboard', () => ({
    default: () => <div>DashboardView</div>,
  }))

  vi.doMock('@/features/workbench/group/GroupDashboard', () => ({
    default: () => <div>GroupDashboardView</div>,
  }))

  const WorkbenchHome = (await import('@/features/workbench/WorkbenchHome')).default
  render(<WorkbenchHome />)
}

describe('WorkbenchHome', () => {
  it('renders group dashboard for group admins with active membership', async () => {
    const { Permission } = await import('@/types')
    await renderWorkbenchHome({
      permissions: [Permission.WORKBENCH_GROUP_DASHBOARD],
      memberships: [{ status: 'active' }],
    })

    expect(screen.getByText('GroupDashboardView')).toBeVisible()
  })

  it('renders global dashboard when no active group membership', async () => {
    const { Permission } = await import('@/types')
    await renderWorkbenchHome({
      permissions: [Permission.WORKBENCH_GROUP_DASHBOARD],
      memberships: [],
    })

    expect(screen.getByText('DashboardView')).toBeVisible()
  })
})
