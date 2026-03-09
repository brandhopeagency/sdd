import { query } from '../db';
import type { AppSettings } from '../types';

const SETTINGS_CACHE_TTL_MS = 30_000;

let cachedSettings: AppSettings | null = null;
let lastLoadedAt = 0;

function rowToSettings(row: any): AppSettings {
  return {
    guestModeEnabled: Boolean(row.guest_mode_enabled),
    approvalCooloffDays: Number(row.approval_cooloff_days) || 7,
    otpLoginDisabledWorkbench: Boolean(row.otp_login_disabled_workbench)
  };
}

export async function getSettings(forceReload: boolean = false): Promise<AppSettings> {
  const now = Date.now();
  if (!forceReload && cachedSettings && now - lastLoadedAt < SETTINGS_CACHE_TTL_MS) {
    return cachedSettings;
  }

  const result = await query(`SELECT guest_mode_enabled, approval_cooloff_days, otp_login_disabled_workbench FROM settings WHERE id = 1`);
  if (result.rows.length === 0) {
    const fallback: AppSettings = { guestModeEnabled: false, approvalCooloffDays: 7, otpLoginDisabledWorkbench: false };
    cachedSettings = fallback;
    lastLoadedAt = now;
    return fallback;
  }

  cachedSettings = rowToSettings(result.rows[0]);
  lastLoadedAt = now;
  return cachedSettings;
}

export async function updateSettings(
  updates: Partial<AppSettings>,
  options?: { forceReload?: boolean }
): Promise<AppSettings> {
  const next = await getSettings(options?.forceReload);
  const guestModeEnabled = updates.guestModeEnabled ?? next.guestModeEnabled;
  const approvalCooloffDays = updates.approvalCooloffDays ?? next.approvalCooloffDays;
  const otpLoginDisabledWorkbench = updates.otpLoginDisabledWorkbench ?? next.otpLoginDisabledWorkbench;

  const result = await query(
    `UPDATE settings
     SET guest_mode_enabled = $1,
         approval_cooloff_days = $2,
         otp_login_disabled_workbench = $3
     WHERE id = 1
     RETURNING guest_mode_enabled, approval_cooloff_days, otp_login_disabled_workbench`,
    [guestModeEnabled, approvalCooloffDays, otpLoginDisabledWorkbench]
  );

  cachedSettings = rowToSettings(result.rows[0]);
  lastLoadedAt = Date.now();
  return cachedSettings;
}

export async function getPublicSettings(): Promise<Pick<AppSettings, 'guestModeEnabled' | 'approvalCooloffDays' | 'otpLoginDisabledWorkbench'> & { googleOAuthAvailable: boolean }> {
  const settings = await getSettings();
  return {
    guestModeEnabled: settings.guestModeEnabled,
    approvalCooloffDays: settings.approvalCooloffDays,
    otpLoginDisabledWorkbench: settings.otpLoginDisabledWorkbench,
    googleOAuthAvailable: !!process.env.GOOGLE_OAUTH_CLIENT_ID
  };
}

export function clearSettingsCache() {
  cachedSettings = null;
  lastLoadedAt = 0;
}

