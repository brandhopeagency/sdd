/**
 * Email Provider Interface
 * 
 * Implement this interface to add a new email provider.
 * The application will use the EMAIL_PROVIDER environment variable
 * to select which provider to use.
 */
export interface EmailProvider {
  /**
   * Provider name for logging/debugging
   */
  readonly name: string;

  /**
   * Send an OTP code to the specified email address
   * 
   * @param to - Recipient email address
   * @param code - The OTP code to send
   * @param expiresInMinutes - How long the code is valid
   * @returns Promise that resolves to true if sent successfully
   */
  sendOtp(to: string, code: string, expiresInMinutes: number): Promise<boolean>;

  /**
   * Optional: Send a generic email (e.g. for high-risk alerts)
   * @param options - Email options (to, subject, text, html)
   * @returns Promise that resolves to true if sent successfully
   */
  sendEmail?(options: EmailOptions): Promise<boolean>;

  /**
   * Optional: Check if the provider is properly configured
   * @returns Promise that resolves to true if the provider is ready
   */
  isConfigured?(): Promise<boolean>;
}

/**
 * Email template data for OTP emails
 */
export interface OtpEmailData {
  to: string;
  code: string;
  expiresInMinutes: number;
  appName?: string;
}

/**
 * Common email sending options
 */
export interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Supported email provider names
 */
export type EmailProviderName = 'console' | 'gmail' | 'sendgrid' | 'mailgun';

/**
 * Email provider configuration
 */
export interface EmailProviderConfig {
  provider: EmailProviderName;
  from: string;
  appName?: string;
}

