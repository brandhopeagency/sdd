import { google } from 'googleapis';
import { EmailProvider } from './types';

/**
 * Gmail Email Provider
 * 
 * Uses Gmail API with OAuth2 to send emails.
 * 
 * Required environment variables:
 * - GMAIL_CLIENT_ID
 * - GMAIL_CLIENT_SECRET
 * - GMAIL_REFRESH_TOKEN
 * - EMAIL_FROM
 */
export class GmailEmailProvider implements EmailProvider {
  readonly name = 'gmail';
  
  private oauth2Client: InstanceType<typeof google.auth.OAuth2> | null = null;
  private gmail: ReturnType<typeof google.gmail> | null = null;

  private getOAuth2Client() {
    if (!this.oauth2Client) {
      const clientId = process.env.GMAIL_CLIENT_ID;
      const clientSecret = process.env.GMAIL_CLIENT_SECRET;
      const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

      if (!clientId || !clientSecret || !refreshToken) {
        throw new Error(
          'Gmail provider requires GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, and GMAIL_REFRESH_TOKEN'
        );
      }

      this.oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
      this.oauth2Client.setCredentials({ refresh_token: refreshToken });
    }

    return this.oauth2Client;
  }

  private getGmailClient() {
    if (!this.gmail) {
      this.gmail = google.gmail({ version: 'v1', auth: this.getOAuth2Client() });
    }
    return this.gmail;
  }

  async sendOtp(to: string, code: string, expiresInMinutes: number): Promise<boolean> {
    const from = process.env.EMAIL_FROM;
    const appName = process.env.APP_NAME || 'Chat Application';

    if (!from) {
      throw new Error('EMAIL_FROM environment variable is required');
    }

    const subject = `Your verification code: ${code}`;
    
    const textContent = `
Your verification code is: ${code}

This code will expire in ${expiresInMinutes} minutes.

If you didn't request this code, please ignore this email.

- ${appName}
`.trim();

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verification Code</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px;">
  <div style="max-width: 480px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);">
    <h1 style="color: #333333; font-size: 24px; margin: 0 0 20px 0; text-align: center;">
      Verification Code
    </h1>
    
    <p style="color: #666666; font-size: 16px; line-height: 1.5; margin: 0 0 30px 0; text-align: center;">
      Enter this code to verify your email address:
    </p>
    
    <div style="background-color: #f8f9fa; border-radius: 8px; padding: 24px; text-align: center; margin: 0 0 30px 0;">
      <span style="font-family: 'SF Mono', Monaco, 'Courier New', monospace; font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #333333;">
        ${code}
      </span>
    </div>
    
    <p style="color: #999999; font-size: 14px; line-height: 1.5; margin: 0 0 10px 0; text-align: center;">
      This code will expire in <strong>${expiresInMinutes} minutes</strong>.
    </p>
    
    <p style="color: #999999; font-size: 14px; line-height: 1.5; margin: 0; text-align: center;">
      If you didn't request this code, you can safely ignore this email.
    </p>
    
    <hr style="border: none; border-top: 1px solid #eeeeee; margin: 30px 0;">
    
    <p style="color: #bbbbbb; font-size: 12px; margin: 0; text-align: center;">
      ${appName}
    </p>
  </div>
</body>
</html>
`.trim();

    // Create the email message
    const messageParts = [
      `From: ${appName} <${from}>`,
      `To: ${to}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: multipart/alternative; boundary="boundary"',
      '',
      '--boundary',
      'Content-Type: text/plain; charset="UTF-8"',
      '',
      textContent,
      '',
      '--boundary',
      'Content-Type: text/html; charset="UTF-8"',
      '',
      htmlContent,
      '',
      '--boundary--'
    ];

    const message = messageParts.join('\r\n');
    const encodedMessage = Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    try {
      const gmail = this.getGmailClient();
      
      await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage
        }
      });

      console.log(`[Gmail] OTP email sent to ${to}`);
      return true;
    } catch (error) {
      console.error('[Gmail] Failed to send email:', error);
      throw error;
    }
  }

  async isConfigured(): Promise<boolean> {
    const clientId = process.env.GMAIL_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET;
    const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
    const from = process.env.EMAIL_FROM;

    return !!(clientId && clientSecret && refreshToken && from);
  }
}

export default GmailEmailProvider;

