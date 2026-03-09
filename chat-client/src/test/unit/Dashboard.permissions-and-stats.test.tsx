import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { maskName } from '@/utils/piiMasking'

const fetchUsers = vi.fn()
const fetchSessions = vi.fn()
const getUsersStats = vi.fn()
const getSessionsStats = vi.fn()
const listApprovals = vi.fn()

async function importDashboard() {
  return (await import('@/features/workbench/Dashboard')).default
}

describe('Workbench Dashboard: permission-aware fetching and stats', () => {
  it('does not call fetchUsers/fetchSessions or stats endpoints without permissions', () => {
    vi.resetModules()
    fetchUsers.mockReset()
    fetchSessions.mockReset()
    getUsersStats.mockReset()
    getSessionsStats.mockReset()
    listApprovals.mockReset()

    vi.doMock('@/stores/workbenchStore', () => ({
      useWorkbenchStore: () => ({
        users: [],
        sessions: [],
        fetchUsers,
        fetchSessions,
        piiMasked: true,
      }),
    }))

    vi.doMock('@/stores/authStore', () => ({
      useAuthStore: () => ({
        user: { displayName: 'Test', permissions: [], role: 'user' },
      }),
    }))

    vi.doMock('@/services/api', () => ({
      usersApi: { getStats: (...args: any[]) => getUsersStats(...args) },
      sessionsAdminApi: { getStats: (...args: any[]) => getSessionsStats(...args) },
      adminApprovalsApi: { list: (...args: any[]) => listApprovals(...args) },
    }))

    vi.doMock('react-router-dom', async (importOriginal) => {
      const original = await importOriginal<typeof import('react-router-dom')>()
      return { ...original, useNavigate: () => vi.fn() }
    })

    return importDashboard().then((Dashboard) => {
      render(<Dashboard />)

      expect(fetchUsers).not.toHaveBeenCalled()
      expect(fetchSessions).not.toHaveBeenCalled()
      expect(getUsersStats).not.toHaveBeenCalled()
      expect(getSessionsStats).not.toHaveBeenCalled()
      expect(listApprovals).not.toHaveBeenCalled()
    })
  })

  it('calls users + sessions fetch + stats when permissions are present', async () => {
    vi.resetModules()
    fetchUsers.mockReset()
    fetchSessions.mockReset()
    getUsersStats.mockReset()
    getSessionsStats.mockReset()
    listApprovals.mockReset()

    const { Permission } = await import('@/types')

    vi.doMock('@/stores/workbenchStore', () => ({
      useWorkbenchStore: () => ({
        users: [],
        sessions: [],
        fetchUsers,
        fetchSessions,
        piiMasked: true,
      }),
    }))

    vi.doMock('@/stores/authStore', () => ({
      useAuthStore: () => ({
        user: {
          displayName: 'Admin',
          permissions: [Permission.WORKBENCH_USER_MANAGEMENT, Permission.WORKBENCH_RESEARCH],
          role: 'owner',
        },
      }),
    }))

    vi.doMock('@/services/api', () => ({
      usersApi: { getStats: (...args: any[]) => getUsersStats(...args) },
      sessionsAdminApi: { getStats: (...args: any[]) => getSessionsStats(...args) },
      adminApprovalsApi: { list: (...args: any[]) => listApprovals(...args) },
    }))

    vi.doMock('react-router-dom', async (importOriginal) => {
      const original = await importOriginal<typeof import('react-router-dom')>()
      return { ...original, useNavigate: () => vi.fn() }
    })

    getUsersStats.mockResolvedValueOnce({
      success: true,
      data: { total: 10, byStatus: { active: 8, blocked: 2 }, byRole: {} },
    })
    getSessionsStats.mockResolvedValueOnce({
      success: true,
      data: { total: 5, byStatus: { active: 1, ended: 3, expired: 1 }, byModerationStatus: { pending: 2, in_review: 1, moderated: 2 } },
    })
    listApprovals.mockResolvedValueOnce({ success: true, data: [] })

    const Dashboard = await importDashboard()
    render(<Dashboard />)

    expect(fetchUsers).toHaveBeenCalledWith({ page: 1, limit: 5 })
    expect(fetchSessions).toHaveBeenCalledWith({ page: 1, limit: 5 })
    await waitFor(() => {
      expect(getUsersStats).toHaveBeenCalledTimes(1)
      expect(getSessionsStats).toHaveBeenCalledTimes(1)
      expect(listApprovals).toHaveBeenCalledTimes(1)
    })
  })

  it('adds title tooltip for recent user names and respects piiMasked', async () => {
    vi.resetModules()

    const { Permission } = await import('@/types')
    getUsersStats.mockReset()
    getSessionsStats.mockReset()
    listApprovals.mockReset()

    vi.doMock('@/stores/workbenchStore', () => ({
      useWorkbenchStore: () => ({
        users: [
          {
            id: 'u1',
            displayName: 'Antonina Boleyn',
            email: 'a@b.com',
            role: 'user',
            status: 'active',
            createdAt: new Date(),
            updatedAt: new Date(),
            lastLoginAt: null,
            sessionCount: 0,
          },
        ],
        sessions: [],
        fetchUsers,
        fetchSessions,
        piiMasked: false,
      }),
    }))

    vi.doMock('@/stores/authStore', () => ({
      useAuthStore: () => ({
        user: {
          displayName: 'Admin',
          permissions: [Permission.WORKBENCH_USER_MANAGEMENT],
          role: 'owner',
        },
      }),
    }))

    vi.doMock('@/services/api', () => ({
      usersApi: { getStats: (...args: any[]) => getUsersStats(...args) },
      sessionsAdminApi: { getStats: (...args: any[]) => getSessionsStats(...args) },
      adminApprovalsApi: { list: (...args: any[]) => listApprovals(...args) },
    }))

    vi.doMock('react-router-dom', async (importOriginal) => {
      const original = await importOriginal<typeof import('react-router-dom')>()
      return { ...original, useNavigate: () => vi.fn() }
    })

    const Dashboard = await importDashboard()
    getUsersStats.mockResolvedValueOnce({ success: false })
    listApprovals.mockResolvedValueOnce({ success: true, data: [] })
    const { unmount } = render(<Dashboard />)

    const fullNameEl = screen.getByText('Antonina Boleyn')
    expect(fullNameEl).toHaveAttribute('title', 'Antonina Boleyn')

    // Masked case should not reveal the full name in tooltip.
    unmount()
    vi.resetModules()
    getUsersStats.mockReset()
    getSessionsStats.mockReset()
    listApprovals.mockReset()

    vi.doMock('@/stores/workbenchStore', () => ({
      useWorkbenchStore: () => ({
        users: [
          {
            id: 'u1',
            displayName: 'Antonina Boleyn',
            email: 'a@b.com',
            role: 'user',
            status: 'active',
            createdAt: new Date(),
            updatedAt: new Date(),
            lastLoginAt: null,
            sessionCount: 0,
          },
        ],
        sessions: [],
        fetchUsers,
        fetchSessions,
        piiMasked: true,
      }),
    }))

    vi.doMock('@/stores/authStore', () => ({
      useAuthStore: () => ({
        user: {
          displayName: 'Admin',
          permissions: [Permission.WORKBENCH_USER_MANAGEMENT],
          role: 'owner',
        },
      }),
    }))

    vi.doMock('@/services/api', () => ({
      usersApi: { getStats: (...args: any[]) => getUsersStats(...args) },
      sessionsAdminApi: { getStats: (...args: any[]) => getSessionsStats(...args) },
      adminApprovalsApi: { list: (...args: any[]) => listApprovals(...args) },
    }))

    vi.doMock('react-router-dom', async (importOriginal) => {
      const original = await importOriginal<typeof import('react-router-dom')>()
      return { ...original, useNavigate: () => vi.fn() }
    })

    const DashboardMasked = await importDashboard()
    getUsersStats.mockResolvedValueOnce({ success: false })
    listApprovals.mockResolvedValueOnce({ success: true, data: [] })
    render(<DashboardMasked />)

    const masked = maskName('Antonina Boleyn')
    const maskedEl = screen.getByText(masked)
    expect(maskedEl).toHaveAttribute('title', masked)
    expect(maskedEl).not.toHaveAttribute('title', 'Antonina Boleyn')
  })
})


