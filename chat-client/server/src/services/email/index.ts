import { EmailProvider, EmailProviderName } from './types';
import { ConsoleEmailProvider } from './console.provider';
import { GmailEmailProvider } from './gmail.provider';

// Singleton instance
let emailProvider: EmailProvider | null = null;

/**
 * Get the configured email provider
 * 
 * Uses EMAIL_PROVIDER environment variable to determine which provider to use.
 * Defaults to 'console' for development.
 */
export function getEmailProvider(): EmailProvider {
  if (!emailProvider) {
    const providerName = (process.env.EMAIL_PROVIDER || 'console') as EmailProviderName;
    
    switch (providerName) {
      case 'gmail':
        emailProvider = new GmailEmailProvider();
        break;
      
      case 'console':
      default:
        emailProvider = new ConsoleEmailProvider();
        break;
    }

    console.log(`✓ Email provider initialized: ${emailProvider.name}`);
  }

  return emailProvider;
}

/**
 * Send an OTP email using the configured provider
 */
export async function sendOtpEmail(
  to: string, 
  code: string, 
  expiresInMinutes: number = 5
): Promise<boolean> {
  const provider = getEmailProvider();
  return provider.sendOtp(to, code, expiresInMinutes);
}

/**
 * Check if email provider is properly configured
 */
export async function isEmailConfigured(): Promise<boolean> {
  const provider = getEmailProvider();
  return provider.isConfigured?.() ?? true;
}

/**
 * Reset the email provider (useful for testing)
 */
export function resetEmailProvider(): void {
  emailProvider = null;
}

// Re-export types
export * from './types';
export { ConsoleEmailProvider } from './console.provider';
export { GmailEmailProvider } from './gmail.provider';

