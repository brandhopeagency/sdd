import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

describe('SettingsView', () => {
  it('loads admin settings and toggles PII masking', async () => {
    vi.resetModules()
    const togglePIIMask = vi.fn()
    const logPiiReveal = vi.fn()
    const getAdminSettings = vi.fn().mockResolvedValue({
      success: true,
      data: { guestModeEnabled: true, approvalCooloffDays: 7 },
    })

    vi.doMock('react-i18next', () => ({
      useTranslation: () => ({ t: (key: string) => key }),
    }))

    const { Permission } = await import('@/types')

    vi.doMock('@/stores/authStore', () => ({
      useAuthStore: () => ({
        user: {
          displayName: 'Test User',
          email: 'test@example.com',
          role: 'owner',
          permissions: [Permission.DATA_VIEW_PII],
        },
      }),
    }))

    vi.doMock('@/stores/workbenchStore', () => ({
      useWorkbenchStore: () => ({
        piiMasked: true,
        togglePIIMask,
      }),
    }))

    vi.doMock('@/services/api', () => ({
      adminAuditApi: { logPiiReveal },
      adminSettingsApi: { get: getAdminSettings, update: vi.fn() },
    }))

    vi.doMock('@/components/LanguageSelector', () => ({
      default: () => <div>LanguageSelector</div>,
    }))

    const SettingsView = (await import('@/features/workbench/settings/SettingsView')).default
    render(<SettingsView />)

    await waitFor(() => {
      expect(getAdminSettings).toHaveBeenCalled()
    })

    const piiToggle = screen.getByLabelText('settings.privacy.piiMasking')
    fireEvent.click(piiToggle)

    expect(logPiiReveal).toHaveBeenCalled()
    expect(togglePIIMask).toHaveBeenCalled()
  })
})
