import { query } from '../db';
import type { AppSettings } from '../types';

const SETTINGS_CACHE_TTL_MS = 30_000;

let cachedSettings: AppSettings | null = null;
let lastLoadedAt = 0;

function rowToSettings(row: any): AppSettings {
  return {
    guestModeEnabled: Boolean(row.guest_mode_enabled),
    approvalCooloffDays: Number(row.approval_cooloff_days) || 7
  };
}

export async function getSettings(forceReload: boolean = false): Promise<AppSettings> {
  const now = Date.now();
  if (!forceReload && cachedSettings && now - lastLoadedAt < SETTINGS_CACHE_TTL_MS) {
    return cachedSettings;
  }

  const result = await query(`SELECT guest_mode_enabled, approval_cooloff_days FROM settings WHERE id = 1`);
  if (result.rows.length === 0) {
    const fallback: AppSettings = { guestModeEnabled: false, approvalCooloffDays: 7 };
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

  const result = await query(
    `UPDATE settings
     SET guest_mode_enabled = $1,
         approval_cooloff_days = $2
     WHERE id = 1
     RETURNING guest_mode_enabled, approval_cooloff_days`,
    [guestModeEnabled, approvalCooloffDays]
  );

  cachedSettings = rowToSettings(result.rows[0]);
  lastLoadedAt = Date.now();
  return cachedSettings;
}

export async function getPublicSettings(): Promise<Pick<AppSettings, 'guestModeEnabled' | 'approvalCooloffDays'>> {
  const settings = await getSettings();
  return {
    guestModeEnabled: settings.guestModeEnabled,
    approvalCooloffDays: settings.approvalCooloffDays
  };
}

export function clearSettingsCache() {
  cachedSettings = null;
  lastLoadedAt = 0;
}

