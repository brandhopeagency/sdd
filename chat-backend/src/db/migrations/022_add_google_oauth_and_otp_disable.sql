-- Add Google OAuth identity column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub VARCHAR(255) UNIQUE;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_sub ON users(google_sub) WHERE google_sub IS NOT NULL;

-- Add OTP disable setting for workbench
ALTER TABLE settings ADD COLUMN IF NOT EXISTS otp_login_disabled_workbench BOOLEAN NOT NULL DEFAULT FALSE;
