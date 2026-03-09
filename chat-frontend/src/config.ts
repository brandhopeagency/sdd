// API Configuration
export const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace(/\/$/, '');

// External workbench app URL
export const WORKBENCH_URL = (import.meta.env.VITE_WORKBENCH_URL || 'http://localhost:5174').replace(/\/$/, '');

// Feature flags
// Default: true (guest chat enabled). Set VITE_ALLOW_GUEST_ACCESS="false" to disable.
export const ALLOW_GUEST_ACCESS =
  (() => {
    const raw = import.meta.env.VITE_ALLOW_GUEST_ACCESS;
    if (raw === undefined) return true;
    const v = String(raw).trim().toLowerCase();
    return v === '1' || v === 'true' || v === 'yes' || v === 'on';
  })();

