/// <reference types="vitest/globals" />

import type { AuthenticatedUser } from '@/types'

async function setup(options?: { initialToken?: string | null }) {
  vi.resetModules()
  localStorage.clear()

  const authApi = {
    sendOtp: vi.fn(),
    verifyOtp: vi.fn(),
    refresh: vi.fn(),
    logout: vi.fn(async () => ({ success: true, data: { message: 'ok' } })),
    getMe: vi.fn(),
  }
  const setAccessToken = vi.fn()
  const clearTokens = vi.fn()
  const getAccessToken = vi.fn(() => options?.initialToken ?? null)

  vi.doMock('@/services/api', () => ({
    authApi,
    settingsApi: { getPublic: vi.fn() },
    setAccessToken,
    clearTokens,
    getAccessToken,
  }))

  const mod = await import('../../stores/authStore')
  const useAuthStore = mod.useAuthStore as typeof import('../../stores/authStore').useAuthStore

  // Reset store state to a known baseline
  useAuthStore.setState({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    isGuest: false,
    guestId: null,
    guestModeEnabled: false,
    approvalCooloffDays: null,
    activeGroupId: null,
    otpSent: false,
    pendingEmail: null,
    otpError: null,
  } as any)

  return { useAuthStore, authApi, setAccessToken, clearTokens, getAccessToken }
}

describe('authStore', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('OTP flow', () => {
    it('sendOtp success sets otpSent and normalized pendingEmail', async () => {
      const { useAuthStore, authApi } = await setup()
      authApi.sendOtp.mockResolvedValueOnce({ success: true, data: { message: 'ok' } })

      const ok = await useAuthStore.getState().sendOtp('  Test@Example.com ')
      expect(ok).toBe(true)

      const s = useAuthStore.getState()
      expect(s.isLoading).toBe(false)
      expect(s.otpSent).toBe(true)
      expect(s.pendingEmail).toBe('test@example.com')
      expect(s.otpError).toBe(null)
    })

    it('sendOtp failure sets otpError from error.code', async () => {
      const { useAuthStore, authApi } = await setup()
      authApi.sendOtp.mockResolvedValueOnce({ success: false, error: { code: 'RATE_LIMIT', message: 'nope' } })

      const ok = await useAuthStore.getState().sendOtp('x@y.com')
      expect(ok).toBe(false)
      expect(useAuthStore.getState().otpError).toBe('rate_limit')
      expect(useAuthStore.getState().otpSent).toBe(false)
    })

    it('verifyOtp success stores token and sets authenticated user', async () => {
      const { useAuthStore, authApi, setAccessToken } = await setup()
      const user: AuthenticatedUser = {
        id: 'u1',
        email: 'x@y.com',
        displayName: 'X',
        role: 'user' as any,
        permissions: [],
        groupId: null,
        memberships: [],
        status: 'active',
        approvedBy: null,
        approvedAt: null,
        disapprovedAt: null,
        disapprovalComment: null,
        disapprovalCount: 0,
        createdAt: new Date(),
        lastLoginAt: new Date(),
      }
      authApi.verifyOtp.mockResolvedValueOnce({
        success: true,
        data: { accessToken: 't1', user, isNewUser: false },
      })

      const resp = await useAuthStore.getState().verifyOtp('x@y.com', '123456')
      expect(resp).toEqual({ success: true, isNewUser: false, user })
      expect(setAccessToken).toHaveBeenCalledWith('t1')

      const s = useAuthStore.getState()
      expect(s.isAuthenticated).toBe(true)
      expect(s.isGuest).toBe(false)
      expect(s.user?.id).toBe('u1')
      expect(s.otpSent).toBe(false)
      expect(s.pendingEmail).toBe(null)
    })

    it('verifyOtp failure maps otpError to lowercased error.code', async () => {
      const { useAuthStore, authApi } = await setup()
      authApi.verifyOtp.mockResolvedValueOnce({
        success: false,
        error: { code: 'INVALID_OTP', message: 'bad' },
      })

      const resp = await useAuthStore.getState().verifyOtp('x@y.com', '000000')
      expect(resp.success).toBe(false)
      expect(useAuthStore.getState().otpError).toBe('invalid_otp')
    })

    it('resetOtpState clears otp flow flags', async () => {
      const { useAuthStore } = await setup()
      useAuthStore.setState({ otpSent: true, pendingEmail: 'a@b.com', otpError: 'x' } as any)
      useAuthStore.getState().resetOtpState()
      expect(useAuthStore.getState().otpSent).toBe(false)
      expect(useAuthStore.getState().pendingEmail).toBe(null)
      expect(useAuthStore.getState().otpError).toBe(null)
    })
  })

  describe('Guest flow', () => {
    it('enterAsGuest sets isGuest + guestId and does not persist guestId', async () => {
      const { useAuthStore } = await setup()
      vi.spyOn(Date, 'now').mockReturnValue(111)
      vi.spyOn(Math, 'random').mockReturnValue(0.123456)

      useAuthStore.setState({ guestModeEnabled: true } as any)
      useAuthStore.getState().enterAsGuest()
      const s = useAuthStore.getState()
      expect(s.isAuthenticated).toBe(true)
      expect(s.isGuest).toBe(true)
      expect(typeof s.guestId).toBe('string')
      expect(s.guestId).toMatch(/^guest_111_/)

      const persisted = localStorage.getItem('auth-storage') || ''
      expect(persisted).not.toContain('guest_')
    })

    it('getEffectiveUserId returns user.id if authenticated user exists', async () => {
      const { useAuthStore } = await setup()
      useAuthStore.setState({ user: { id: 'u-real' } as any } as any)
      expect(useAuthStore.getState().getEffectiveUserId()).toBe('u-real')
    })

    it('getEffectiveUserId returns existing guestId when in guest mode', async () => {
      const { useAuthStore } = await setup()
      useAuthStore.setState({ isGuest: true, guestId: 'guest_1' } as any)
      expect(useAuthStore.getState().getEffectiveUserId()).toBe('guest_1')
    })

    it('upgradeFromGuest sets user and clears guest flags', async () => {
      const { useAuthStore } = await setup()
      useAuthStore.setState({ isGuest: true, guestId: 'guest_1', isAuthenticated: true } as any)
      useAuthStore.getState().upgradeFromGuest({ id: 'u1' } as any)
      const s = useAuthStore.getState()
      expect(s.user?.id).toBe('u1')
      expect(s.isGuest).toBe(false)
      expect(s.guestId).toBe(null)
    })
  })

  describe('Session management', () => {
    it('initializeAuth returns early when no token', async () => {
      const { useAuthStore, getAccessToken } = await setup({ initialToken: null })
      await useAuthStore.getState().initializeAuth()
      expect(getAccessToken).toHaveBeenCalled()
      expect(useAuthStore.getState().isLoading).toBe(false)
    })

    it('refreshSession success stores token and user', async () => {
      const { useAuthStore, authApi, setAccessToken } = await setup()
      authApi.refresh.mockResolvedValueOnce({
        success: true,
        data: { accessToken: 't2', user: { id: 'u2' } },
      })
      const ok = await useAuthStore.getState().refreshSession()
      expect(ok).toBe(true)
      expect(setAccessToken).toHaveBeenCalledWith('t2')
      expect(useAuthStore.getState().user?.id).toBe('u2')
    })

    it('handleApiError triggers refreshSession for auth errors', async () => {
      const { useAuthStore } = await setup()
      const refreshSpy = vi.spyOn(useAuthStore.getState(), 'refreshSession').mockResolvedValueOnce(true)
      const ok = await useAuthStore.getState().handleApiError({ code: 'UNAUTHORIZED' })
      expect(ok).toBe(true)
      expect(refreshSpy).toHaveBeenCalled()
    })

    it('handleApiError triggers refreshSession for authorization errors too', async () => {
      const { useAuthStore } = await setup()
      const refreshSpy = vi.spyOn(useAuthStore.getState(), 'refreshSession').mockResolvedValueOnce(true)
      const ok = await useAuthStore.getState().handleApiError({ code: 'FORBIDDEN' })
      expect(ok).toBe(true)
      expect(refreshSpy).toHaveBeenCalled()
    })
  })
})


