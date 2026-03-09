import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useWorkbenchStore } from '@/stores/workbenchStore';
import { useAuthStore } from '@mentalhelpglobal/chat-frontend-common';
import { Permission } from '@mentalhelpglobal/chat-types';
import { 
  Shield, Eye, EyeOff, Trash2, AlertTriangle
} from 'lucide-react';

export default function PrivacyDashboard() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { users, fetchUsers, piiMasked, togglePIIMask, setPIIMasked } = useWorkbenchStore();
  // searchTerm state will be added when audit log is implemented
  const canViewPii =
    Array.isArray(user?.permissions) && user.permissions.includes(Permission.DATA_VIEW_PII);
  
  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    if (!canViewPii && !piiMasked) {
      setPIIMasked(true);
    }
  }, [canViewPii, piiMasked, setPIIMasked]);

  const anonymizedCount = users.filter(u => u.status === 'anonymized').length;
  const totalUsers = users.length;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-800">{t('privacy.title')}</h1>
        <p className="text-neutral-500 mt-1">{t('privacy.subtitle')}</p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {/* PII Protection Status */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
              <Shield className="w-6 h-6 text-primary-600" />
            </div>
            <button
              onClick={canViewPii ? togglePIIMask : undefined}
              disabled={!canViewPii}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                piiMasked
                  ? 'bg-secondary-100 text-secondary-700'
                  : 'bg-amber-100 text-amber-700'
              } ${canViewPii ? '' : 'opacity-60 cursor-not-allowed'}`}
            >
              {piiMasked ? (
                <>
                  <EyeOff className="w-4 h-4 inline mr-2" />
                  {t('workbench.pii.masked')}
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4 inline mr-2" />
                  {t('workbench.pii.visible')}
                </>
              )}
            </button>
          </div>
          <h3 className="font-semibold text-neutral-900">{t('privacy.piiProtection.title')}</h3>
          <p className="text-sm text-neutral-500 mt-1">
            {piiMasked 
              ? t('privacy.piiProtection.masked')
              : t('privacy.piiProtection.visible')
            }
          </p>
        </div>

        {/* Data Requests */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>
          </div>
          <h3 className="font-semibold text-neutral-900">{t('privacy.dataRequests.title')}</h3>
          <p className="text-sm text-neutral-500 mt-1">
            {t('privacy.comingSoon.title', 'Coming soon')}
          </p>
          <p className="text-xs text-neutral-500 mt-2">
            {t('privacy.comingSoon.description', 'For GDPR requests, contact support while this feature is in progress.')}
          </p>
          <a
            href={t('privacy.supportLink', 'mailto:support@mentalhelp.global')}
            className="text-xs text-primary-600 hover:text-primary-700 mt-2 inline-block"
          >
            {t('privacy.supportContact', 'Contact support')}
          </a>
        </div>

        {/* Anonymized Records */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-neutral-100 rounded-xl flex items-center justify-center">
              <Trash2 className="w-6 h-6 text-neutral-600" />
            </div>
            <span className="text-2xl font-bold text-neutral-900">
              {anonymizedCount}
            </span>
          </div>
          <h3 className="font-semibold text-neutral-900">{t('privacy.anonymizedRecords.title')}</h3>
          <p className="text-sm text-neutral-500 mt-1">
            {anonymizedCount} / {totalUsers} {t('privacy.anonymizedRecords.subtitle')}
          </p>
        </div>
      </div>

      {/* Audit log / GDPR actions placeholder (avoid fake "prod" data) */}
      <div className="card p-6 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-amber-700" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">{t('privacy.auditLog.title')}</h2>
            <p className="text-sm text-neutral-500">
              {t('privacy.comingSoon.auditLog', 'Audit log reporting is coming soon.')}
            </p>
            <a
              href={t('privacy.supportLink', 'mailto:support@mentalhelp.global')}
              className="text-xs text-primary-600 hover:text-primary-700 mt-2 inline-block"
            >
              {t('privacy.supportContact', 'Contact support')}
            </a>
          </div>
        </div>

        {/* Search will be enabled when audit log is implemented */}
      </div>

      {/* GDPR Info */}
      <div className="mt-6 p-4 bg-primary-50 border border-primary-200 rounded-lg">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-primary-900">{t('privacy.gdprCompliance.title')}</h3>
            <p className="text-sm text-primary-700 mt-1">
              {t('privacy.gdprCompliance.description')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
