import { EmailProvider } from './types';

/**
 * Console Email Provider
 * 
 * Logs OTP codes to the console instead of sending emails.
 * Useful for local development and testing.
 */
export class ConsoleEmailProvider implements EmailProvider {
  readonly name = 'console';

  async sendOtp(to: string, code: string, expiresInMinutes: number): Promise<boolean> {
    const timestamp = new Date().toISOString();
    
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║                    📧 OTP EMAIL (Console)                    ║');
    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log(`║  To:      ${to.padEnd(50)}║`);
    console.log(`║  Code:    ${code.padEnd(50)}║`);
    console.log(`║  Expires: ${expiresInMinutes} minutes`.padEnd(63) + '║');
    console.log(`║  Time:    ${timestamp.padEnd(50)}║`);
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');

    return true;
  }

  async isConfigured(): Promise<boolean> {
    return true; // Console provider is always configured
  }
}

export default ConsoleEmailProvider;

