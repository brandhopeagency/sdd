/**
 * Minimal PII masking utilities (server-side).
 *
 * NOTE: This is intentionally conservative: it masks only obvious patterns
 * (emails, phone numbers) and avoids logging any PII values.
 */

/**
 * Mask an email address.
 * alex.chen@example.com -> a***@***.com
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return '***@***.***';

  const [local, domain] = email.split('@');
  const domainParts = domain.split('.');
  const tld = domainParts.pop() || 'com';

  return `${local[0] || '*'}***@***.${tld}`;
}

/**
 * Mask a phone number (keep last 4 digits).
 */
export function maskPhone(phone: string): string {
  if (!phone) return '***-***-****';

  const digits = phone.replace(/\D/g, '');
  const last4 = digits.slice(-4) || '****';

  return `***-***-${last4}`;
}

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_REGEX = /(\+?1?[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g;

/**
 * Mask obvious PII patterns inside text.
 */
export function maskPIIInText(text: string): string {
  if (!text) return text;
  return text.replace(EMAIL_REGEX, (m) => maskEmail(m)).replace(PHONE_REGEX, (m) => maskPhone(m));
}

/**
 * Deeply traverse unknown JSON-like values and mask PII in string leaf values.
 * Safe for API responses (it creates new arrays/objects).
 */
export function maskPIIInUnknown<T>(value: T): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const v: any = value;

  if (v === null || v === undefined) return value;

  if (typeof v === 'string') {
    return maskPIIInText(v) as unknown as T;
  }

  if (Array.isArray(v)) {
    return v.map((item) => maskPIIInUnknown(item)) as unknown as T;
  }

  if (typeof v === 'object') {
    // Preserve plain objects only (good enough for JSON responses).
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v)) {
      out[k] = maskPIIInUnknown(val);
    }
    return out as unknown as T;
  }

  return value;
}

