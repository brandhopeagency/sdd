/// <reference types="vitest/globals" />

import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock providers to avoid loading external dependencies (googleapis) and to make selection deterministic.
vi.mock('../../src/services/email/console.provider', () => ({
  ConsoleEmailProvider: class {
    name = 'console'
    sendOtp = vi.fn(async () => true)
    isConfigured = vi.fn(async () => true)
  },
}))

vi.mock('../../src/services/email/gmail.provider', () => ({
  GmailEmailProvider: class {
    name = 'gmail'
    sendOtp = vi.fn(async () => true)
    isConfigured = vi.fn(async () => false)
  },
}))

describe('email provider wiring', () => {
  beforeEach(() => {
    vi.resetModules()
    delete process.env.EMAIL_PROVIDER
  })

  it('defaults to console provider when EMAIL_PROVIDER not set', async () => {
    const email = await import('../../src/services/email')
    email.resetEmailProvider()
    const provider = email.getEmailProvider()
    expect(provider.name).toBe('console')
  })

  it('selects gmail provider when EMAIL_PROVIDER=gmail', async () => {
    process.env.EMAIL_PROVIDER = 'gmail'
    const email = await import('../../src/services/email')
    email.resetEmailProvider()
    const provider = email.getEmailProvider()
    expect(provider.name).toBe('gmail')
  })

  it('isEmailConfigured delegates to provider.isConfigured when present', async () => {
    process.env.EMAIL_PROVIDER = 'gmail'
    const email = await import('../../src/services/email')
    email.resetEmailProvider()
    await expect(email.isEmailConfigured()).resolves.toBe(false)
  })

  it('sendOtpEmail delegates to provider.sendOtp', async () => {
    const email = await import('../../src/services/email')
    email.resetEmailProvider()
    const ok = await email.sendOtpEmail('x@y.com', '123456', 5)
    expect(ok).toBe(true)
  })
})


