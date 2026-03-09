/// <reference types="vitest/globals" />

import { maskEmail, maskName, maskPhone, maskPIIInText, maskUser } from '@/utils/piiMasking'

describe('piiMasking', () => {
  describe('maskEmail', () => {
    it('returns default mask for empty/invalid values', () => {
      expect(maskEmail('')).toBe('***@***.***')
      expect(maskEmail('not-an-email')).toBe('***@***.***')
      expect(maskEmail('missing-at.example.com')).toBe('***@***.***')
    })

    it('masks local part and domain, preserves TLD', () => {
      expect(maskEmail('alex.chen@example.com')).toBe('a***@***.com')
      expect(maskEmail('a@ex.co.uk')).toBe('a***@***.uk')
      expect(maskEmail('bob@company.global')).toBe('b***@***.global')
    })
  })

  describe('maskName', () => {
    it('returns default mask for empty', () => {
      expect(maskName('')).toBe('***')
      expect(maskName('   ')).toBe('***')
    })

    it('handles single word names', () => {
      expect(maskName('Amy')).toBe('Amy')
      expect(maskName('Alexander')).toBe('Alex...')
      expect(maskName('  Alex  ')).toBe('Alex')
    })

    it('handles multi-word names, keeping first name and last initial', () => {
      expect(maskName('Alex Chen')).toBe('Alex C...')
      expect(maskName('  Alex   Chen  ')).toBe('Alex C...')
      expect(maskName('Mary Jane Watson')).toBe('Mary W...')
    })
  })

  describe('maskPhone', () => {
    it('returns default mask for empty', () => {
      expect(maskPhone('')).toBe('***-***-****')
    })

    it('keeps last 4 digits and masks the rest', () => {
      expect(maskPhone('555-123-4567')).toBe('***-***-4567')
      expect(maskPhone('(555) 123 4567')).toBe('***-***-4567')
      expect(maskPhone('+1 555 123 4567')).toBe('***-***-4567')
    })

    it('handles short/odd inputs by using whatever last digits exist', () => {
      expect(maskPhone('123')).toBe('***-***-123')
      expect(maskPhone('12-34')).toBe('***-***-1234')
    })
  })

  describe('maskPIIInText', () => {
    it('masks emails and phone numbers in text (multiple occurrences)', () => {
      const input =
        'Contact alex.chen@example.com or bob@company.global. Phone: (555) 123-4567, backup 555.123.4567.'
      const out = maskPIIInText(input)

      expect(out).toContain('a***@***.com')
      expect(out).toContain('b***@***.global')
      expect(out).toContain('***-***-4567')
      // Should not leak raw email/phone
      expect(out).not.toContain('alex.chen@example.com')
      expect(out).not.toContain('bob@company.global')
      expect(out).not.toContain('555-123-4567')
    })
  })

  describe('maskUser', () => {
    it('returns the same object when isMasked is false', () => {
      const u = { email: 'alex.chen@example.com', displayName: 'Alex Chen' }
      expect(maskUser(u, false)).toBe(u)
    })

    it('masks only email/displayName when isMasked is true', () => {
      const u = { email: 'alex.chen@example.com', displayName: 'Alex Chen', extra: 123 }
      expect(maskUser(u, true)).toEqual({
        email: 'a***@***.com',
        displayName: 'Alex C...',
        extra: 123,
      })
    })

    it('keeps undefined fields as undefined when masked', () => {
      const u = { email: undefined, displayName: undefined }
      expect(maskUser(u, true)).toEqual({ email: undefined, displayName: undefined })
    })
  })
})


