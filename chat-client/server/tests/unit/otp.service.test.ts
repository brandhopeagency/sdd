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
    randomBytes: vi.fn(),
  },
}))

vi.mock('../../src/services/email', () => ({
  sendOtpEmail: vi.fn(),
}))

import crypto from 'crypto'
import bcrypt from 'bcrypt'
import { query } from '../../src/db'
import { sendOtpEmail } from '../../src/services/email'

import { cleanupExpiredOtps, hasPendingOtp, sendOtp, verifyOtp } from '../../src/services/otp.service'

describe('otp.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.EMAIL_PROVIDER
  })

  describe('sendOtp', () => {
    it('generates, stores and sends OTP; returns code only for console provider', async () => {
      process.env.EMAIL_PROVIDER = 'console'

      const buf = Buffer.alloc(4)
      buf.writeUInt32BE(1000000, 0) // deterministic
      vi.mocked(crypto.randomBytes).mockReturnValueOnce(buf as any)
      vi.mocked(bcrypt.hash).mockResolvedValueOnce('hashed' as any)

      vi.mocked(query)
        .mockResolvedValueOnce({ rows: [] } as any) // delete existing
        .mockResolvedValueOnce({ rows: [] } as any) // insert new

      vi.mocked(sendOtpEmail).mockResolvedValueOnce(true as any)

      const resp = await sendOtp('  Test@Example.com ')
      expect(resp.success).toBe(true)
      expect(resp.code).toMatch(/^\d{6}$/)

      // delete + insert queries executed with normalized email
      expect(vi.mocked(query).mock.calls[0][1]).toEqual(['test@example.com'])
      expect(String(vi.mocked(query).mock.calls[1][0])).toContain('INSERT INTO otp_codes')
      expect(vi.mocked(sendOtpEmail)).toHaveBeenCalledWith('test@example.com', expect.any(String), 5)
    })

    it('returns success without code for non-console provider', async () => {
      process.env.EMAIL_PROVIDER = 'gmail'

      const buf = Buffer.alloc(4)
      buf.writeUInt32BE(1000000, 0)
      vi.mocked(crypto.randomBytes).mockReturnValueOnce(buf as any)
      vi.mocked(bcrypt.hash).mockResolvedValueOnce('hashed' as any)
      vi.mocked(query)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
      vi.mocked(sendOtpEmail).mockResolvedValueOnce(true as any)

      const resp = await sendOtp('x@y.com')
      expect(resp).toEqual({ success: true })
    })

    it('returns success:false on error', async () => {
      vi.mocked(query).mockRejectedValueOnce(new Error('db down'))
      const resp = await sendOtp('x@y.com')
      expect(resp.success).toBe(false)
      expect(resp.error).toMatch(/Failed to send verification code/)
    })
  })

  describe('verifyOtp', () => {
    it('returns no_otp_found when no otp exists', async () => {
      vi.mocked(query).mockResolvedValueOnce({ rows: [] } as any)
      const resp = await verifyOtp('x@y.com', '123456')
      expect(resp).toEqual({ valid: false, error: 'no_otp_found' })
    })

    it('deletes and returns otp_expired when expired', async () => {
      vi.mocked(query)
        .mockResolvedValueOnce({ rows: [{ id: 'o1', expires_at: new Date(Date.now() - 1000), attempts: 0, code_hash: 'h' }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any) // delete expired
      const resp = await verifyOtp('x@y.com', '123456')
      expect(resp).toEqual({ valid: false, error: 'otp_expired' })
      expect(String(vi.mocked(query).mock.calls[1][0])).toContain('DELETE FROM otp_codes')
    })

    it('deletes and returns max_attempts_exceeded when attempts already maxed', async () => {
      vi.mocked(query)
        .mockResolvedValueOnce({ rows: [{ id: 'o1', expires_at: new Date(Date.now() + 100000), attempts: 3, code_hash: 'h' }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any) // delete
      const resp = await verifyOtp('x@y.com', '123456')
      expect(resp).toEqual({ valid: false, error: 'max_attempts_exceeded' })
    })

    it('increments attempts and returns invalid_otp when code mismatch', async () => {
      vi.mocked(query)
        .mockResolvedValueOnce({ rows: [{ id: 'o1', expires_at: new Date(Date.now() + 100000), attempts: 0, code_hash: 'h' }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any) // update attempts
      vi.mocked(bcrypt.compare).mockResolvedValueOnce(false as any)

      const resp = await verifyOtp('x@y.com', '000000')
      expect(resp).toEqual({ valid: false, error: 'invalid_otp' })
      expect(String(vi.mocked(query).mock.calls[1][0])).toContain('UPDATE otp_codes SET attempts = attempts + 1')
    })

    it('deletes and returns valid:true when code matches', async () => {
      vi.mocked(query)
        .mockResolvedValueOnce({ rows: [{ id: 'o1', expires_at: new Date(Date.now() + 100000), attempts: 0, code_hash: 'h' }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any) // update attempts
      vi.mocked(bcrypt.compare).mockResolvedValueOnce(true as any)
      vi.mocked(query).mockResolvedValueOnce({ rows: [] } as any) // delete used otp

      const resp = await verifyOtp('x@y.com', '123456')
      expect(resp).toEqual({ valid: true })
      expect(String(vi.mocked(query).mock.calls.at(-1)?.[0] || '')).toContain('DELETE FROM otp_codes')
    })

    it('returns verification_failed on unexpected error', async () => {
      vi.mocked(query).mockRejectedValueOnce(new Error('boom'))
      const resp = await verifyOtp('x@y.com', '123456')
      expect(resp).toEqual({ valid: false, error: 'verification_failed' })
    })
  })

  describe('cleanupExpiredOtps', () => {
    it('returns rowCount when delete succeeds', async () => {
      vi.mocked(query).mockResolvedValueOnce({ rowCount: 7, rows: [] } as any)
      const count = await cleanupExpiredOtps()
      expect(count).toBe(7)
    })

    it('returns 0 on error', async () => {
      vi.mocked(query).mockRejectedValueOnce(new Error('boom'))
      const count = await cleanupExpiredOtps()
      expect(count).toBe(0)
    })
  })

  describe('hasPendingOtp', () => {
    it('returns true when count > 0', async () => {
      vi.mocked(query).mockResolvedValueOnce({ rows: [{ count: '1' }] } as any)
      await expect(hasPendingOtp('x@y.com')).resolves.toBe(true)
    })

    it('returns false when count is 0', async () => {
      vi.mocked(query).mockResolvedValueOnce({ rows: [{ count: '0' }] } as any)
      await expect(hasPendingOtp('x@y.com')).resolves.toBe(false)
    })
  })
})


