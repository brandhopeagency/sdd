import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { query } from '../db';
import { sendOtpEmail } from './email';
import { OtpRecord } from '../types';

const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 5;
const MAX_ATTEMPTS = 3;
const BCRYPT_ROUNDS = 10;

/**
 * Generate a cryptographically secure OTP code
 */
function generateOtpCode(): string {
  // Generate random bytes and convert to a 6-digit number
  const randomBytes = crypto.randomBytes(4);
  const randomNumber = randomBytes.readUInt32BE(0);
  const code = (randomNumber % 900000 + 100000).toString();
  return code;
}

/**
 * Send OTP to an email address
 * - Deletes any existing OTP for this email
 * - Generates a new OTP
 * - Stores hashed OTP in database
 * - Sends OTP via email
 */
export async function sendOtp(email: string): Promise<{ success: boolean; error?: string; code?: string }> {
  const normalizedEmail = email.toLowerCase().trim();
  const isConsoleProvider = process.env.EMAIL_PROVIDER === 'console';
  
  try {
    // Delete any existing OTPs for this email
    await query('DELETE FROM otp_codes WHERE email = $1', [normalizedEmail]);
    
    // Generate new OTP
    const code = generateOtpCode();
    const codeHash = await bcrypt.hash(code, BCRYPT_ROUNDS);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
    
    // Store hashed OTP in database
    await query(
      `INSERT INTO otp_codes (email, code_hash, expires_at) VALUES ($1, $2, $3)`,
      [normalizedEmail, codeHash, expiresAt]
    );
    
    // Send OTP via email
    await sendOtpEmail(normalizedEmail, code, OTP_EXPIRY_MINUTES);
    
    console.log(`[OTP] Code sent to ${normalizedEmail}`);
    
    // Return code for browser console display if using console provider (dev environment)
    if (isConsoleProvider) {
      return { success: true, code };
    }
    
    return { success: true };
  } catch (error) {
    console.error('[OTP] Error sending OTP:', error);
    return { 
      success: false, 
      error: 'Failed to send verification code' 
    };
  }
}

/**
 * Verify an OTP code for an email address
 * - Finds the most recent OTP for the email
 * - Checks if it's expired
 * - Checks attempt count
 * - Verifies the code hash
 * - Deletes the OTP on success
 */
export async function verifyOtp(
  email: string, 
  code: string
): Promise<{ valid: boolean; error?: string }> {
  const normalizedEmail = email.toLowerCase().trim();
  
  try {
    // Get the most recent OTP for this email
    const result = await query<OtpRecord>(
      `SELECT * FROM otp_codes 
       WHERE email = $1 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [normalizedEmail]
    );
    
    if (result.rows.length === 0) {
      return { valid: false, error: 'no_otp_found' };
    }
    
    const otpRecord = result.rows[0];
    
    // Check if expired
    if (new Date() > new Date(otpRecord.expires_at)) {
      // Delete expired OTP
      await query('DELETE FROM otp_codes WHERE id = $1', [otpRecord.id]);
      return { valid: false, error: 'otp_expired' };
    }
    
    // Check attempt count
    if (otpRecord.attempts >= MAX_ATTEMPTS) {
      // Delete OTP after max attempts
      await query('DELETE FROM otp_codes WHERE id = $1', [otpRecord.id]);
      return { valid: false, error: 'max_attempts_exceeded' };
    }
    
    // Increment attempt count
    await query(
      'UPDATE otp_codes SET attempts = attempts + 1 WHERE id = $1',
      [otpRecord.id]
    );
    
    // Verify the code
    const isValid = await bcrypt.compare(code, otpRecord.code_hash);
    
    if (!isValid) {
      const remainingAttempts = MAX_ATTEMPTS - (otpRecord.attempts + 1);
      console.log(`[OTP] Invalid code for ${normalizedEmail}. ${remainingAttempts} attempts remaining`);
      return { valid: false, error: 'invalid_otp' };
    }
    
    // Delete the OTP after successful verification
    await query('DELETE FROM otp_codes WHERE id = $1', [otpRecord.id]);
    
    console.log(`[OTP] Code verified for ${normalizedEmail}`);
    
    return { valid: true };
  } catch (error) {
    console.error('[OTP] Error verifying OTP:', error);
    return { valid: false, error: 'verification_failed' };
  }
}

/**
 * Clean up expired OTPs
 * This should be called periodically (e.g., via cron job)
 */
export async function cleanupExpiredOtps(): Promise<number> {
  try {
    const result = await query(
      'DELETE FROM otp_codes WHERE expires_at < NOW()'
    );
    const count = result.rowCount || 0;
    
    if (count > 0) {
      console.log(`[OTP] Cleaned up ${count} expired OTP codes`);
    }
    
    return count;
  } catch (error) {
    console.error('[OTP] Error cleaning up expired OTPs:', error);
    return 0;
  }
}

/**
 * Check if an email has a pending (non-expired) OTP
 */
export async function hasPendingOtp(email: string): Promise<boolean> {
  const normalizedEmail = email.toLowerCase().trim();
  
  const result = await query(
    `SELECT COUNT(*) as count FROM otp_codes 
     WHERE email = $1 AND expires_at > NOW()`,
    [normalizedEmail]
  );
  
  return parseInt(result.rows[0]?.count || '0') > 0;
}

export default {
  sendOtp,
  verifyOtp,
  cleanupExpiredOtps,
  hasPendingOtp
};

