import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../../stores/authStore';
import { useWorkbenchStore } from '../../../stores/workbenchStore';
import { Permission } from '../../../types';
import { adminAuditApi, adminSettingsApi } from '../../../services/api';
import { maskEmail, maskName } from '../../../utils/piiMasking';
import { 
  User, Bell, Shield, Palette, Globe, 
  Moon, Sun, Monitor, Check
} from 'lucide-react';
import LanguageSelector from '../../../components/LanguageSelector';

export default function SettingsView() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { piiMasked, togglePIIMask } = useWorkbenchStore();
  const canViewPii = user?.permissions.includes(Permission.DATA_VIEW_PII) ?? false;
  const isOwner = user?.role === 'owner';

  const displayName = user?.displayName ? (piiMasked ? maskName(user.displayName) : user.displayName) : '';
  const displayEmail = user?.email ? (piiMasked ? maskEmail(user.email) : user.email) : '';
  
  const [notifications, setNotifications] = useState({
    email: true,
    browser: false,
    digest: true
  });
  
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('light');
  const [adminSettings, setAdminSettings] = useState<{ guestModeEnabled: boolean; approvalCooloffDays: number } | null>(
    null
  );
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);

  const loadAdminSettings = useCallback(async () => {
    if (!isOwner) return;
    setAdminLoading(true);
    setAdminError(null);
    try {
      const resp = await adminSettingsApi.get();
      if (!resp.success || !resp.data) {
        setAdminError(resp.error?.message || t('common.error'));
        return;
      }
      setAdminSettings(resp.data);
    } catch (e) {
      console.error('[Settings] Failed to load admin settings:', e);
      setAdminError(t('common.error'));
    } finally {
      setAdminLoading(false);
    }
  }, [isOwner, t]);

  useEffect(() => {
    void loadAdminSettings();
  }, [loadAdminSettings]);

  const handlePiiToggle = () => {
    if (!canViewPii) return;
    if (piiMasked) {
      void adminAuditApi.logPiiReveal({
        context: 'settings',
        path: '/workbench/settings',
        visible: true
      });
    }
    togglePIIMask();
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-800">{t('settings.title')}</h1>
        <p className="text-neutral-500 mt-1">{t('settings.subtitle')}</p>
      </div>

      {/* Profile Section */}
      <div className="card p-6 mb-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center">
            <User className="w-8 h-8 text-primary-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-neutral-900">{displayName}</h2>
            <p className="text-neutral-500">{displayEmail}</p>
            <span className="badge-info mt-1">{t(`roles.${user?.role}`)}</span>
          </div>
        </div>
      </div>

      {/* Privacy Settings */}
      <div className="card p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="w-5 h-5 text-neutral-500" />
          <h2 className="text-lg font-semibold text-neutral-900">{t('settings.privacy.title')}</h2>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-lg">
            <div>
              <h3 className="font-medium text-neutral-900">{t('settings.privacy.piiMasking')}</h3>
              <p className="text-sm text-neutral-500">{t('settings.privacy.piiMaskingDesc')}</p>
            </div>
            {canViewPii ? (
              <button
                onClick={handlePiiToggle}
                className={`relative w-14 h-8 rounded-full transition-colors overflow-hidden shrink-0 ${
                  piiMasked ? 'bg-secondary-500' : 'bg-neutral-300'
                }`}
                aria-label={t('settings.privacy.piiMasking')}
              >
                <span
                  className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                    piiMasked ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            ) : (
              <span className="text-sm text-neutral-500">{t('workbench.pii.masked')}</span>
            )}
          </div>
        </div>
      </div>

      {/* Notification Settings */}
      <div className="card p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Bell className="w-5 h-5 text-neutral-500" />
          <h2 className="text-lg font-semibold text-neutral-900">{t('settings.notifications.title')}</h2>
        </div>

        <div className="space-y-4">
          {[
            { key: 'email', labelKey: 'settings.notifications.email', descKey: 'settings.notifications.emailDesc' },
            { key: 'browser', labelKey: 'settings.notifications.browser', descKey: 'settings.notifications.browserDesc' },
            { key: 'digest', labelKey: 'settings.notifications.digest', descKey: 'settings.notifications.digestDesc' },
          ].map(({ key, labelKey, descKey }) => (
            <div key={key} className="flex items-center justify-between p-4 bg-neutral-50 rounded-lg">
              <div>
                <h3 className="font-medium text-neutral-900">{t(labelKey)}</h3>
                <p className="text-sm text-neutral-500">{t(descKey)}</p>
              </div>
              <button
                onClick={() => setNotifications(n => ({ 
                  ...n, 
                  [key]: !n[key as keyof typeof n] 
                }))}
                className={`relative w-14 h-8 rounded-full transition-colors overflow-hidden shrink-0 ${
                  notifications[key as keyof typeof notifications] ? 'bg-secondary-500' : 'bg-neutral-300'
                }`}
              >
                <span
                  className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                    notifications[key as keyof typeof notifications] ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Appearance Settings */}
      <div className="card p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Palette className="w-5 h-5 text-neutral-500" />
          <h2 className="text-lg font-semibold text-neutral-900">{t('settings.appearance.title')}</h2>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { value: 'light', labelKey: 'settings.appearance.light', icon: Sun },
            { value: 'dark', labelKey: 'settings.appearance.dark', icon: Moon },
            { value: 'system', labelKey: 'settings.appearance.system', icon: Monitor },
          ].map(({ value, labelKey, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setTheme(value as typeof theme)}
              className={`p-4 rounded-lg border-2 transition-colors ${
                theme === value
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-neutral-200 hover:border-neutral-300'
              }`}
            >
              <Icon className={`w-6 h-6 mx-auto mb-2 ${
                theme === value ? 'text-primary-600' : 'text-neutral-500'
              }`} />
              <span className={`text-sm font-medium ${
                theme === value ? 'text-primary-700' : 'text-neutral-700'
              }`}>
                {t(labelKey)}
              </span>
              {theme === value && (
                <Check className="w-4 h-4 text-primary-600 mx-auto mt-1" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Language Settings */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-4">
          <Globe className="w-5 h-5 text-neutral-500" />
          <h2 className="text-lg font-semibold text-neutral-900">{t('settings.language.title')}</h2>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              {t('settings.language.language')}
            </label>
            <LanguageSelector variant="dropdown" className="w-full" />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              {t('settings.language.timezone')}
            </label>
            <select className="input">
              <option value="UTC">UTC</option>
              <option value="Europe/Kyiv">Kyiv (UTC+2)</option>
              <option value="Europe/London">London (UTC+0)</option>
              <option value="Europe/Moscow">Moscow (UTC+3)</option>
              <option value="America/New_York">New York (UTC-5)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Admin Settings */}
      {isOwner && (
        <div className="card p-6 mt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-neutral-900">{t('settings.admin.title')}</h2>
              <p className="text-sm text-neutral-500">{t('settings.admin.subtitle')}</p>
            </div>
            <button className="btn-ghost" onClick={() => void loadAdminSettings()}>
              {t('settings.admin.reload')}
            </button>
          </div>
          {adminError && <div className="text-sm text-red-600 mb-3">{adminError}</div>}
          {adminSettings && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-lg">
                <div>
                  <h3 className="font-medium text-neutral-900">{t('settings.admin.guestMode')}</h3>
                  <p className="text-sm text-neutral-500">{t('settings.admin.guestModeDesc')}</p>
                </div>
                <button
                  onClick={() =>
                    setAdminSettings((prev) =>
                      prev ? { ...prev, guestModeEnabled: !prev.guestModeEnabled } : prev
                    )
                  }
                  className={`relative w-14 h-8 rounded-full transition-colors overflow-hidden shrink-0 ${
                    adminSettings.guestModeEnabled ? 'bg-secondary-500' : 'bg-neutral-300'
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                      adminSettings.guestModeEnabled ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
              <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-lg">
                <div>
                  <h3 className="font-medium text-neutral-900">{t('settings.admin.cooloffDays')}</h3>
                  <p className="text-sm text-neutral-500">{t('settings.admin.cooloffDaysDesc')}</p>
                </div>
                <input
                  className="input w-24"
                  type="number"
                  min={0}
                  max={365}
                  value={adminSettings.approvalCooloffDays}
                  onChange={(e) =>
                    setAdminSettings((prev) =>
                      prev
                        ? {
                            ...prev,
                            approvalCooloffDays: Number.isNaN(parseInt(e.target.value || '0', 10))
                              ? 0
                              : parseInt(e.target.value || '0', 10)
                          }
                        : prev
                    )
                  }
                />
              </div>
              <div className="flex justify-end">
                <button
                  className="btn-primary"
                  disabled={adminLoading}
                  onClick={async () => {
                    if (!adminSettings) return;
                    setAdminLoading(true);
                    setAdminError(null);
                    try {
                      const resp = await adminSettingsApi.update(adminSettings);
                      if (!resp.success || !resp.data) {
                        setAdminError(resp.error?.message || t('common.error'));
                        return;
                      }
                      setAdminSettings(resp.data);
                    } catch (e) {
                      console.error('[Settings] Failed to save admin settings:', e);
                      setAdminError(t('common.error'));
                    } finally {
                      setAdminLoading(false);
                    }
                  }}
                >
                  {t('settings.admin.save')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Save Button */}
      <div className="mt-6 flex justify-end">
        <button className="btn-primary">
          {t('settings.save')}
        </button>
      </div>
    </div>
  );
}
