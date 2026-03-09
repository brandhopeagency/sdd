/// <reference types="vitest/globals" />

import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../src/db', () => ({
  query: vi.fn(),
  transaction: vi.fn(),
  getPool: vi.fn(),
}))

vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
}))

vi.mock('crypto', () => ({
  default: {
    randomUUID: vi.fn(),
  },
}))

vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn(),
    verify: vi.fn(),
  },
}))

import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'
import crypto from 'crypto'
import { query } from '../../src/db'

import {
  findOrCreateUser,
  generateAccessToken,
  refreshTokens,
  verifyAccessToken,
} from '../../src/services/auth.service'

function setSecrets() {
  process.env.JWT_SECRET = 'x'.repeat(32)
  process.env.JWT_REFRESH_SECRET = 'y'.repeat(32)
  process.env.JWT_ACCESS_EXPIRES_IN = '15m'
  process.env.JWT_REFRESH_EXPIRES_IN = '7d'
}

describe('auth.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setSecrets()
  })

  describe('generateAccessToken / verifyAccessToken', () => {
    it('throws when JWT_SECRET is missing/too short', () => {
      process.env.JWT_SECRET = 'short'
      expect(() =>
        generateAccessToken({ id: 'u1', email: 'a@b.com', role: 'user' } as any),
      ).toThrow(/JWT_SECRET must be at least 32 characters/)
    })

    it('signs access token with payload and secret', () => {
      vi.mocked(jwt.sign).mockReturnValueOnce('access-token' as any)
      const token = generateAccessToken({ id: 'u1', email: 'a@b.com', role: 'user' } as any)
      expect(token).toBe('access-token')
      expect(jwt.sign).toHaveBeenCalledWith(
        { sub: 'u1', email: 'a@b.com', role: 'user' },
        process.env.JWT_SECRET,
        expect.objectContaining({ expiresIn: '15m' }),
      )
    })

    it('verifyAccessToken returns payload when valid and null when invalid', () => {
      vi.mocked(jwt.verify).mockReturnValueOnce({ sub: 'u1', email: 'a@b.com', role: 'user' } as any)
      expect(verifyAccessToken('t')).toEqual({ sub: 'u1', email: 'a@b.com', role: 'user' })

      vi.mocked(jwt.verify).mockImplementationOnce(() => {
        throw new Error('bad token')
      })
      expect(verifyAccessToken('bad')).toBeNull()
    })
  })

  describe('refreshTokens', () => {
    it('returns null when JWT_REFRESH_SECRET is missing/too short', async () => {
      process.env.JWT_REFRESH_SECRET = 'short'
      const resp = await refreshTokens('rt')
      expect(resp).toBeNull()
    })

    it('returns null when user not found', async () => {
      vi.mocked(jwt.verify).mockReturnValueOnce({ sub: 'u1', tokenId: 'tid1' } as any)
      vi.mocked(query).mockResolvedValueOnce({ rows: [] } as any) // user lookup
      const resp = await refreshTokens('rt')
      expect(resp).toBeNull()
    })

    it('returns null when user is blocked', async () => {
      vi.mocked(jwt.verify).mockReturnValueOnce({ sub: 'u1', tokenId: 'tid1' } as any)
      vi.mocked(query).mockResolvedValueOnce({ rows: [{ id: 'u1', status: 'blocked' }] } as any) // user lookup
      const resp = await refreshTokens('rt')
      expect(resp).toBeNull()
    })

    it('returns null when no stored refresh token matches payload tokenId', async () => {
      vi.mocked(jwt.verify).mockReturnValueOnce({ sub: 'u1', tokenId: 'tid1' } as any)
      vi.mocked(query)
        .mockResolvedValueOnce({ rows: [{ id: 'u1', email: 'a@b.com', role: 'user', status: 'active' }] } as any) // user
        .mockResolvedValueOnce({ rows: [{ id: 'rt1', token_hash: 'hash1' }] } as any) // token list
      vi.mocked(bcrypt.compare).mockResolvedValueOnce(false as any)

      const resp = await refreshTokens('rt')
      expect(resp).toBeNull()
    })

    it('rotates token (deletes used token) and returns new tokens on success', async () => {
      vi.mocked(jwt.verify).mockReturnValueOnce({ sub: 'u1', tokenId: 'tid1' } as any)

      // jwt.sign is used by generateAccessToken and generateRefreshToken
      vi.mocked(jwt.sign)
        .mockReturnValueOnce('new-access' as any) // access token
        .mockReturnValueOnce('new-refresh' as any) // refresh token

      vi.mocked(crypto.randomUUID).mockReturnValueOnce('newTokenId' as any)
      vi.mocked(bcrypt.hash).mockResolvedValueOnce('hashed-newTokenId' as any)
      vi.mocked(bcrypt.compare).mockResolvedValueOnce(true as any)

      vi.mocked(query)
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'u1',
              email: 'a@b.com',
              role: 'user',
              status: 'active',
              group_id: null,
              display_name: 'A',
              created_at: new Date(),
              last_login_at: new Date(),
            },
          ],
        } as any) // user lookup
        .mockResolvedValueOnce({ rows: [{ id: 'rt-row', token_hash: 'hash-existing' }] } as any) // token list
        .mockResolvedValueOnce({ rows: [] } as any) // delete used token
        .mockResolvedValueOnce({ rows: [] } as any) // insert refresh token
        .mockResolvedValueOnce({ rows: [] } as any) // memberships

      const resp = await refreshTokens('rt')
      expect(resp).not.toBeNull()
      expect(resp!.accessToken).toBe('new-access')
      expect(resp!.refreshToken).toBe('new-refresh')
      expect(resp!.user.id).toBe('u1')

      // rotation delete called
      expect(vi.mocked(query).mock.calls.some((c) => String(c[0]).includes('DELETE FROM refresh_tokens WHERE id'))).toBe(true)
      // insert called
      expect(vi.mocked(query).mock.calls.some((c) => String(c[0]).includes('INSERT INTO refresh_tokens'))).toBe(true)
    })
  })

  describe('findOrCreateUser', () => {
    it('normalizes email and updates existing user last_login_at/session_count', async () => {
      const existing = { id: 'u1', email: 'test@example.com', display_name: 'Test', role: 'user', status: 'active' }
      vi.mocked(query)
        .mockResolvedValueOnce({ rows: [existing] } as any) // find by email
        .mockResolvedValueOnce({ rows: [] } as any) // update last_login/session_count
        .mockResolvedValueOnce({ rows: [{ ...existing, session_count: 2 }] } as any) // refetch

      const resp = await findOrCreateUser('  TEST@Example.com ')
      expect(resp.isNew).toBe(false)
      expect(resp.user.email).toBe('test@example.com')

      // should have queried with normalized email
      expect(vi.mocked(query).mock.calls[0]?.[1]).toEqual(['test@example.com'])
    })

    it('creates new user with generated displayName', async () => {
      vi.mocked(query)
        .mockResolvedValueOnce({ rows: [] } as any) // find by email
        .mockResolvedValueOnce({
          rows: [{ id: 'u2', email: 'john.doe@example.com', display_name: 'John Doe', role: 'user', status: 'approval' }],
        } as any) // insert

      const resp = await findOrCreateUser('john.doe@example.com')
      expect(resp.isNew).toBe(true)
      expect(resp.user.display_name).toBe('John Doe')
    })
  })
})


