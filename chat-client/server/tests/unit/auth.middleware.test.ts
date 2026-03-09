/// <reference types="vitest/globals" />

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextFunction, Request, Response } from 'express'
import { Permission, UserRole } from '../../src/types'

vi.mock('../../src/services/auth.service', () => ({
  verifyAccessToken: vi.fn(),
  getUserById: vi.fn(),
  getAuthUserById: vi.fn(),
}))

import { verifyAccessToken, getUserById, getAuthUserById } from '../../src/services/auth.service'
import {
  authenticate,
  requirePermission,
  requireAllPermissions,
  requireAnyPermission,
  requireActiveAccount,
  getClientIp,
} from '../../src/middleware/auth'

function makeRes() {
  const res: Partial<Response> = {}
  res.status = vi.fn(() => res as Response)
  res.json = vi.fn(() => res as Response)
  return res as Response & { status: any; json: any }
}

function makeReq(partial?: Partial<Request>) {
  return {
    headers: {},
    socket: { remoteAddress: '10.0.0.1' },
    ...partial,
  } as unknown as Request
}

describe('auth middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('authenticate', () => {
    it('returns 401 when no Authorization header', () => {
      const req = makeReq({ headers: {} })
      const res = makeRes()
      const next = vi.fn() as unknown as NextFunction

      authenticate(req, res, next)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: 'UNAUTHORIZED' }),
        }),
      )
      expect(next).not.toHaveBeenCalled()
    })

    it('returns 401 when Authorization header is not Bearer', () => {
      const req = makeReq({ headers: { authorization: 'Basic abc' } as any })
      const res = makeRes()
      const next = vi.fn() as unknown as NextFunction

      authenticate(req, res, next)
      expect(res.status).toHaveBeenCalledWith(401)
      expect(next).not.toHaveBeenCalled()
    })

    it('returns 401 when token is invalid', () => {
      vi.mocked(verifyAccessToken).mockReturnValueOnce(null)
      const req = makeReq({ headers: { authorization: 'Bearer bad' } as any })
      const res = makeRes()
      const next = vi.fn() as unknown as NextFunction

      authenticate(req, res, next)
      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: 'INVALID_TOKEN' }),
        }),
      )
      expect(next).not.toHaveBeenCalled()
    })

    it('attaches req.userId and req.user on success', () => {
      vi.mocked(verifyAccessToken).mockReturnValueOnce({
        sub: 'u1',
        email: 'a@b.com',
        role: UserRole.QA_SPECIALIST,
      } as any)
      const req = makeReq({ headers: { authorization: 'Bearer ok' } as any })
      const res = makeRes()
      const next = vi.fn() as unknown as NextFunction

      authenticate(req, res, next)

      expect(req.userId).toBe('u1')
      expect(req.user?.id).toBe('u1')
      expect(req.user?.email).toBe('a@b.com')
      expect(Array.isArray(req.user?.permissions)).toBe(true)
      expect(next).toHaveBeenCalled()
    })
  })

  describe('permission guards', () => {
    it('requirePermission returns 401 when unauthenticated', () => {
      const mw = requirePermission(Permission.WORKBENCH_ACCESS)
      const req = makeReq({ user: undefined })
      const res = makeRes()
      const next = vi.fn() as any
      mw(req, res, next)
      expect(res.status).toHaveBeenCalledWith(401)
      expect(next).not.toHaveBeenCalled()
    })

    it('requirePermission returns 403 when missing permission', () => {
      const mw = requirePermission(Permission.WORKBENCH_PRIVACY)
      const req = makeReq({ user: { permissions: [Permission.WORKBENCH_ACCESS] } as any })
      const res = makeRes()
      const next = vi.fn() as any
      mw(req, res, next)
      expect(res.status).toHaveBeenCalledWith(403)
      expect(next).not.toHaveBeenCalled()
    })

    it('requirePermission calls next when permission present', () => {
      const mw = requirePermission(Permission.WORKBENCH_ACCESS)
      const req = makeReq({ user: { permissions: [Permission.WORKBENCH_ACCESS] } as any })
      const res = makeRes()
      const next = vi.fn() as any
      mw(req, res, next)
      expect(next).toHaveBeenCalled()
    })

    it('requireAllPermissions enforces all', () => {
      const mw = requireAllPermissions(Permission.WORKBENCH_ACCESS, Permission.WORKBENCH_PRIVACY)
      const req = makeReq({ user: { permissions: [Permission.WORKBENCH_ACCESS] } as any })
      const res = makeRes()
      const next = vi.fn() as any
      mw(req, res, next)
      expect(res.status).toHaveBeenCalledWith(403)
    })

    it('requireAnyPermission accepts any', () => {
      const mw = requireAnyPermission(Permission.WORKBENCH_PRIVACY, Permission.WORKBENCH_ACCESS)
      const req = makeReq({ user: { permissions: [Permission.WORKBENCH_ACCESS] } as any })
      const res = makeRes()
      const next = vi.fn() as any
      mw(req, res, next)
      expect(next).toHaveBeenCalled()
    })
  })

  describe('requireActiveAccount', () => {
    it('returns 401 when req.userId missing', async () => {
      const req = makeReq({ userId: undefined })
      const res = makeRes()
      const next = vi.fn() as any
      await requireActiveAccount(req, res, next)
      expect(res.status).toHaveBeenCalledWith(401)
      expect(next).not.toHaveBeenCalled()
    })

    it('returns 401 when user not found', async () => {
      vi.mocked(getUserById).mockResolvedValueOnce(null as any)
      const req = makeReq({ userId: 'u1' })
      const res = makeRes()
      const next = vi.fn() as any
      await requireActiveAccount(req, res, next)
      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, error: expect.objectContaining({ code: 'USER_NOT_FOUND' }) }),
      )
    })

    it('returns 403 when user is blocked', async () => {
      vi.mocked(getUserById).mockResolvedValueOnce({ id: 'u1', status: 'blocked' } as any)
      const req = makeReq({ userId: 'u1' })
      const res = makeRes()
      const next = vi.fn() as any
      await requireActiveAccount(req, res, next)
      expect(res.status).toHaveBeenCalledWith(403)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, error: expect.objectContaining({ code: 'ACCOUNT_BLOCKED' }) }),
      )
    })

    it('returns 403 when user is anonymized', async () => {
      vi.mocked(getUserById).mockResolvedValueOnce({ id: 'u1', status: 'anonymized' } as any)
      const req = makeReq({ userId: 'u1' })
      const res = makeRes()
      const next = vi.fn() as any
      await requireActiveAccount(req, res, next)
      expect(res.status).toHaveBeenCalledWith(403)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, error: expect.objectContaining({ code: 'ACCOUNT_DELETED' }) }),
      )
    })

    it('calls next and populates req.user with full data when ok', async () => {
      vi.mocked(getUserById).mockResolvedValueOnce({
        id: 'u1',
        email: 'a@b.com',
        display_name: 'A',
        role: UserRole.RESEARCHER,
        status: 'active',
        group_id: null,
        session_count: 0,
        last_login_at: null,
        metadata: {},
        created_at: new Date(),
        updated_at: new Date(),
      } as any)
      vi.mocked(getAuthUserById).mockResolvedValueOnce({
        id: 'u1',
        email: 'a@b.com',
        displayName: 'A',
        role: UserRole.RESEARCHER,
        permissions: [],
        groupId: null,
        groupMemberships: [],
        status: 'active',
        approvedBy: null,
        approvedAt: null,
        disapprovedAt: null,
        disapprovalComment: null,
        disapprovalCount: 0,
        createdAt: new Date(),
        lastLoginAt: new Date(),
      } as any)
      const req = makeReq({ userId: 'u1', user: { id: 'u1', permissions: [] } as any })
      const res = makeRes()
      const next = vi.fn() as any
      await requireActiveAccount(req, res, next)
      expect(req.user?.id).toBe('u1')
      expect(next).toHaveBeenCalled()
    })

    it('returns 500 on db error', async () => {
      vi.mocked(getUserById).mockRejectedValueOnce(new Error('db down'))
      const req = makeReq({ userId: 'u1' })
      const res = makeRes()
      const next = vi.fn() as any
      await requireActiveAccount(req, res, next)
      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, error: expect.objectContaining({ code: 'INTERNAL_ERROR' }) }),
      )
    })
  })

  describe('getClientIp', () => {
    it('uses x-forwarded-for (string) first ip', () => {
      const req = makeReq({ headers: { 'x-forwarded-for': '1.1.1.1, 2.2.2.2' } as any })
      expect(getClientIp(req)).toBe('1.1.1.1')
    })

    it('uses x-forwarded-for (array) first entry', () => {
      const req = makeReq({ headers: { 'x-forwarded-for': ['3.3.3.3, 4.4.4.4'] } as any })
      expect(getClientIp(req)).toBe('3.3.3.3')
    })

    it('falls back to socket.remoteAddress', () => {
      const req = makeReq({ headers: {} })
      expect(getClientIp(req)).toBe('10.0.0.1')
    })
  })
})


