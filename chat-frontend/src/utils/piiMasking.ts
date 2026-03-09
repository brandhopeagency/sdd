/**
 * PII Masking Utilities
 * Used to protect personally identifiable information in the Workbench
 */

/**
 * Mask an email address
 * alex.chen@example.com -> a***@***.com
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return '***@***.***';
  
  const [local, domain] = email.split('@');
  const domainParts = domain.split('.');
  const tld = domainParts.pop() || 'com';
  
  return `${local[0]}***@***.${tld}`;
}

/**
 * Mask a display name
 * Alex Chen -> Alex C...
 */
export function maskName(name: string): string {
  if (!name || !name.trim()) return '***';
  
  const parts = name.trim().split(' ');
  if (parts.length === 1) {
    return parts[0].length > 4 ? `${parts[0].slice(0, 4)}...` : parts[0];
  }
  
  // Keep first name, mask last name
  const firstName = parts[0];
  const lastInitial = parts[parts.length - 1][0];
  return `${firstName} ${lastInitial}...`;
}

/**
 * Mask a user ID
 * usr_001 -> ****
 */
export function maskUserId(userId: string): string {
  if (!userId) return '****';
  return '****';
}

/**
 * Mask a phone number
 * 555-123-4567 -> ***-***-4567
 */
export function maskPhone(phone: string): string {
  if (!phone) return '***-***-****';
  
  // Get last 4 digits
  const digits = phone.replace(/\D/g, '');
  const last4 = digits.slice(-4);
  
  return `***-***-${last4}`;
}

/**
 * Generic masking function that detects and masks PII in text
 */
export function maskPIIInText(text: string): string {
  let masked = text;
  
  // Mask email addresses
  masked = masked.replace(
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    (match) => maskEmail(match)
  );
  
  // Mask phone numbers (various formats)
  masked = masked.replace(
    /(\+?1?[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g,
    (match) => maskPhone(match)
  );
  
  return masked;
}

/**
 * Apply masking to a user object
 */
export function maskUser<T extends { email?: string; displayName?: string; id?: string }>(
  user: T,
  isMasked: boolean
): T {
  if (!isMasked) return user;
  
  return {
    ...user,
    email: user.email ? maskEmail(user.email) : undefined,
    displayName: user.displayName ? maskName(user.displayName) : undefined,
  };
}

