/// <reference types="vitest/globals" />

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { AddressInfo } from 'node:net'
import cookieParser from 'cookie-parser'
import express from 'express'

const queryMock = vi.fn()
const sendOtpMock = vi.fn()
const verifyOtpMock = vi.fn()
const authenticateWithOtpMock = vi.fn()
const refreshTokensMock = vi.fn()
const invalidateAllRefreshTokensMock = vi.fn()
const getUserByIdMock = vi.fn()
const getAuthUserByIdMock = vi.fn()

vi.mock('../../src/db', () => ({
  query: (...args: any[]) => queryMock(...args),
}))

vi.mock('../../src/services/otp.service', () => ({
  sendOtp: (...args: any[]) => sendOtpMock(...args),
  verifyOtp: (...args: any[]) => verifyOtpMock(...args),
}))

vi.mock('../../src/services/auth.service', () => ({
  authenticateWithOtp: (...args: any[]) => authenticateWithOtpMock(...args),
  refreshTokens: (...args: any[]) => refreshTokensMock(...args),
  invalidateAllRefreshTokens: (...args: any[]) => invalidateAllRefreshTokensMock(...args),
  getUserById: (...args: any[]) => getUserByIdMock(...args),
  getAuthUserById: (...args: any[]) => getAuthUserByIdMock(...args),
}))

// Keep route-layer tests focused: mock auth middleware and avoid JWT verification.
vi.mock('../../src/middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.userId = 'u1'
    req.user = { id: 'u1', status: 'active', permissions: [], role: 'user' }
    next()
  },
  getClientIp: () => '127.0.0.1',
}))

async function startAuthApp() {
  const authRouter = (await import('../../src/routes/auth')).default
  const app = express()
  app.use(express.json())
  app.use(cookieParser())
  app.use('/api/auth', authRouter)

  const server = await new Promise<import('node:http').Server>((resolve) => {
    const s = app.listen(0, () => resolve(s))
  })
  const port = (server.address() as AddressInfo).port
  const baseUrl = `http://127.0.0.1:${port}`
  return { server, baseUrl }
}

describe('auth routes: validation + error mapping', () => {
  beforeEach(() => {
    vi.resetModules()
    queryMock.mockReset()
    sendOtpMock.mockReset()
    verifyOtpMock.mockReset()
    authenticateWithOtpMock.mockReset()
    refreshTokensMock.mockReset()
    invalidateAllRefreshTokensMock.mockReset()
    getUserByIdMock.mockReset()
    getAuthUserByIdMock.mockReset()
    process.env.NODE_ENV = 'test'
    process.env.FRONTEND_URL = 'http://localhost:5173'
  })

  afterEach(() => {
    delete process.env.FRONTEND_URL
    delete process.env.NODE_ENV
  })

  it('POST /api/auth/otp/send: 400 when email missing', async () => {
    const { server, baseUrl } = await startAuthApp()
    try {
      const resp = await fetch(`${baseUrl}/api/auth/otp/send`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      })
      expect(resp.status).toBe(400)
      const body = await resp.json()
      expect(body.success).toBe(false)
      expect(body.error.code).toBe('INVALID_REQUEST')
    } finally {
      server.close()
    }
  })

  it('POST /api/auth/otp/send: 400 when email invalid', async () => {
    const { server, baseUrl } = await startAuthApp()
    try {
      const resp = await fetch(`${baseUrl}/api/auth/otp/send`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'not-an-email' }),
      })
      expect(resp.status).toBe(400)
      const body = await resp.json()
      expect(body.error.code).toBe('INVALID_EMAIL')
    } finally {
      server.close()
    }
  })

  it('POST /api/auth/otp/send: 403 when account blocked', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ status: 'blocked' }] })

    const { server, baseUrl } = await startAuthApp()
    try {
      const resp = await fetch(`${baseUrl}/api/auth/otp/send`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'a@b.com' }),
      })
      expect(resp.status).toBe(403)
      const body = await resp.json()
      expect(body.error.code).toBe('ACCOUNT_BLOCKED')
      expect(sendOtpMock).not.toHaveBeenCalled()
    } finally {
      server.close()
    }
  })

  it('POST /api/auth/otp/send: 500 when sendOtp fails', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] })
    sendOtpMock.mockResolvedValueOnce({ success: false, error: 'nope' })

    const { server, baseUrl } = await startAuthApp()
    try {
      const resp = await fetch(`${baseUrl}/api/auth/otp/send`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'a@b.com' }),
      })
      expect(resp.status).toBe(500)
      const body = await resp.json()
      expect(body.error.code).toBe('OTP_SEND_FAILED')
    } finally {
      server.close()
    }
  })

  it('POST /api/auth/otp/send: includes devCode when provider returns code', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] })
    sendOtpMock.mockResolvedValueOnce({ success: true, code: '123456' })

    const { server, baseUrl } = await startAuthApp()
    try {
      const resp = await fetch(`${baseUrl}/api/auth/otp/send`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'a@b.com' }),
      })
      expect(resp.status).toBe(200)
      const body = await resp.json()
      expect(body.success).toBe(true)
      expect(body.data.devCode).toBe('123456')
    } finally {
      server.close()
    }
  })

  it('POST /api/auth/refresh: 403 when origin forbidden', async () => {
    const { server, baseUrl } = await startAuthApp()
    try {
      const resp = await fetch(`${baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'https://evil.example',
        },
        body: JSON.stringify({ refreshToken: 'r1' }),
      })
      expect(resp.status).toBe(403)
      const body = await resp.json()
      expect(body.error.code).toBe('FORBIDDEN_ORIGIN')
    } finally {
      server.close()
    }
  })

  it('POST /api/auth/refresh: 401 when refresh token missing', async () => {
    const { server, baseUrl } = await startAuthApp()
    try {
      const resp = await fetch(`${baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'http://localhost:5173' },
        body: JSON.stringify({}),
      })
      expect(resp.status).toBe(401)
      const body = await resp.json()
      expect(body.error.code).toBe('NO_REFRESH_TOKEN')
    } finally {
      server.close()
    }
  })

  it('POST /api/auth/refresh: 401 and clears cookie when refreshTokens returns null', async () => {
    refreshTokensMock.mockResolvedValueOnce(null)

    const { server, baseUrl } = await startAuthApp()
    try {
      const resp = await fetch(`${baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'http://localhost:5173',
          cookie: 'refreshToken=bad',
        },
      })
      expect(resp.status).toBe(401)
      const body = await resp.json()
      expect(body.error.code).toBe('INVALID_REFRESH_TOKEN')
      const setCookie = resp.headers.get('set-cookie') || ''
      expect(setCookie.toLowerCase()).toContain('refreshtoken=')
    } finally {
      server.close()
    }
  })

  it('POST /api/auth/refresh: 200 and sets cookie when refresh succeeds', async () => {
    refreshTokensMock.mockResolvedValueOnce({
      accessToken: 'a1',
      refreshToken: 'r2',
      user: { id: 'u1', email: 'a@b.com', displayName: 'A', role: 'user', permissions: [] },
    })

    const { server, baseUrl } = await startAuthApp()
    try {
      const resp = await fetch(`${baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'http://localhost:5173',
          cookie: 'refreshToken=ok',
        },
      })
      expect(resp.status).toBe(200)
      const body = await resp.json()
      expect(body.success).toBe(true)
      expect(body.data.accessToken).toBe('a1')
      const setCookie = resp.headers.get('set-cookie') || ''
      expect(setCookie.toLowerCase()).toContain('refreshtoken=')
    } finally {
      server.close()
    }
  })

  it('GET /api/auth/me: 404 when user not found', async () => {
    getAuthUserByIdMock.mockResolvedValueOnce(null)

    const { server, baseUrl } = await startAuthApp()
    try {
      const resp = await fetch(`${baseUrl}/api/auth/me`, { method: 'GET' })
      expect(resp.status).toBe(404)
      const body = await resp.json()
      expect(body.error.code).toBe('USER_NOT_FOUND')
    } finally {
      server.close()
    }
  })

  it('GET /api/auth/me: 403 when user blocked', async () => {
    getAuthUserByIdMock.mockResolvedValueOnce({ id: 'u1', status: 'blocked' })

    const { server, baseUrl } = await startAuthApp()
    try {
      const resp = await fetch(`${baseUrl}/api/auth/me`, { method: 'GET' })
      expect(resp.status).toBe(403)
      const body = await resp.json()
      expect(body.error.code).toBe('ACCOUNT_BLOCKED')
    } finally {
      server.close()
    }
  })

  it('POST /api/auth/logout: invalidates refresh tokens for authenticated user', async () => {
    invalidateAllRefreshTokensMock.mockResolvedValueOnce(undefined)

    const { server, baseUrl } = await startAuthApp()
    try {
      const resp = await fetch(`${baseUrl}/api/auth/logout`, { method: 'POST' })
      expect(resp.status).toBe(200)
      expect(invalidateAllRefreshTokensMock).toHaveBeenCalledWith('u1')
    } finally {
      server.close()
    }
  })
})


