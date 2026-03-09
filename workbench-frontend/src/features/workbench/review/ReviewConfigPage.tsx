import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useReviewStore } from '@/stores/reviewStore';
import type { ReviewConfiguration } from '@mentalhelpglobal/chat-types';

export default function ReviewConfigPage() {
  const { t } = useTranslation();
  const { config, fetchConfig, updateConfig, error, clearError } = useReviewStore();
  
  const [formData, setFormData] = useState<Partial<ReviewConfiguration>>({});
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Load config on mount
  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  // Update form data when config loads
  useEffect(() => {
    if (config) {
      setFormData({
        minReviews: config.minReviews,
        maxReviews: config.maxReviews,
        criteriaThreshold: config.criteriaThreshold,
        autoFlagThreshold: config.autoFlagThreshold,
        varianceLimit: config.varianceLimit,
        timeoutHours: config.timeoutHours,
        highRiskSlaHours: config.highRiskSlaHours,
        mediumRiskSlaHours: config.mediumRiskSlaHours,
        deanonymizationAccessHours: config.deanonymizationAccessHours,
        minMessageThreshold: config.minMessageThreshold,
        supervisionPolicy: config.supervisionPolicy,
        supervisionSamplePercentage: config.supervisionSamplePercentage,
      });
    }
  }, [config]);

  // Clear success message after 3 seconds
  useEffect(() => {
    if (saveSuccess) {
      const timer = setTimeout(() => setSaveSuccess(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [saveSuccess]);

  const validateField = (field: string, value: number | undefined): string | null => {
    if (value === undefined) return null;
    
    switch (field) {
      case 'minReviews':
      case 'maxReviews':
        if (value < 1 || value > 10) {
          return t('review.config.validation.range', { min: 1, max: 10 });
        }
        break;
      case 'criteriaThreshold':
      case 'autoFlagThreshold':
        if (value < 1 || value > 10) {
          return t('review.config.validation.range', { min: 1, max: 10 });
        }
        break;
      case 'varianceLimit':
        if (value < 0.1 || value > 9.9) {
          return t('review.config.validation.varianceRange', { min: 0.1, max: 9.9 });
        }
        break;
      case 'timeoutHours':
        if (value < 1 || value > 72) {
          return t('review.config.validation.range', { min: 1, max: 72 });
        }
        break;
      case 'highRiskSlaHours':
        if (value < 1 || value > 48) {
          return t('review.config.validation.range', { min: 1, max: 48 });
        }
        break;
      case 'mediumRiskSlaHours':
        if (value < 1 || value > 168) {
          return t('review.config.validation.range', { min: 1, max: 168 });
        }
        break;
      case 'deanonymizationAccessHours':
        if (value < 1 || value > 168) {
          return t('review.config.validation.range', { min: 1, max: 168 });
        }
        break;
      case 'minMessageThreshold':
        if (value < 1 || value > 100) {
          return t('review.config.validation.range', { min: 1, max: 100 });
        }
        break;
    }
    return null;
  };

  const handleChange = (field: keyof ReviewConfiguration, value: number) => {
    const error = validateField(field, value);
    const nextData = { ...formData, [field]: value };
    setValidationErrors((prev) => {
      const next = { ...prev };
      if (error) {
        next[field] = error;
      } else {
        delete next[field];
      }
      // Cross-field: maxReviews >= minReviews
      const minVal = nextData.minReviews ?? config?.minReviews ?? 0;
      const maxVal = nextData.maxReviews ?? config?.maxReviews ?? 0;
      if (maxVal < minVal) {
        next.maxReviews = t('review.config.validation.maxReviewsGteMin');
      } else {
        delete next.maxReviews;
      }
      return next;
    });
    setFormData(nextData);
    clearError();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate all fields
    const errors: Record<string, string> = {};
    Object.entries(formData).forEach(([field, value]) => {
      const error = validateField(field, typeof value === 'number' ? value : undefined);
      if (error) {
        errors[field] = error;
      }
    });

    // Cross-field: maxReviews must be >= minReviews
    const minVal = formData.minReviews ?? config?.minReviews ?? 0;
    const maxVal = formData.maxReviews ?? config?.maxReviews ?? 0;
    if (maxVal < minVal) {
      errors.maxReviews = t('review.config.validation.maxReviewsGteMin');
      setValidationErrors(errors);
      return;
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    setSaving(true);
    setSaveSuccess(false);
    clearError();

    try {
      await updateConfig(formData);
      setSaveSuccess(true);
      // Refresh config to get updated timestamp
      await fetchConfig();
    } catch {
      // Error is handled by the store
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (date: Date | string | null | undefined): string => {
    if (!date) return '';
    const d = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  };

  if (!config) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-neutral-800">{t('review.config.title')}</h1>
        <p className="text-neutral-500">{t('review.common.loading')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-neutral-800">{t('review.config.title')}</h1>
        {config.updatedAt && (
          <p className="mt-1 text-sm text-neutral-500">
            {t('review.config.lastUpdated', {
              date: formatDate(config.updatedAt),
              user: config.updatedBy || t('review.config.unknownUser'),
            })}
          </p>
        )}
      </div>

      {/* Success Message */}
      {saveSuccess && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800">
          {t('review.config.saved')}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Minimum Reviews */}
            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-1">
                {t('review.config.minReviews')}
              </label>
              <p className="text-xs text-neutral-500 mb-2">{t('review.config.minReviewsDesc')}</p>
              <input
                type="number"
                min="1"
                max="10"
                value={formData.minReviews ?? config.minReviews}
                onChange={(e) => handleChange('minReviews', parseInt(e.target.value) || 0)}
                className={`w-full rounded-md border px-3 py-2 text-sm ${
                  validationErrors.minReviews
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                    : 'border-neutral-300 focus:border-blue-500 focus:ring-blue-500'
                }`}
              />
              {validationErrors.minReviews && (
                <p className="mt-1 text-xs text-red-600">{validationErrors.minReviews}</p>
              )}
            </div>

            {/* Maximum Reviews */}
            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-1">
                {t('review.config.maxReviews')}
              </label>
              <p className="text-xs text-neutral-500 mb-2">{t('review.config.maxReviewsDesc')}</p>
              <input
                type="number"
                min="1"
                max="10"
                value={formData.maxReviews ?? config.maxReviews}
                onChange={(e) => handleChange('maxReviews', parseInt(e.target.value) || 0)}
                className={`w-full rounded-md border px-3 py-2 text-sm ${
                  validationErrors.maxReviews
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                    : 'border-neutral-300 focus:border-blue-500 focus:ring-blue-500'
                }`}
              />
              {validationErrors.maxReviews && (
                <p className="mt-1 text-xs text-red-600">{validationErrors.maxReviews}</p>
              )}
            </div>

            {/* Criteria Threshold */}
            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-1">
                {t('review.config.criteriaThreshold')}
              </label>
              <p className="text-xs text-neutral-500 mb-2">{t('review.config.criteriaThresholdDesc')}</p>
              <input
                type="number"
                min="1"
                max="10"
                value={formData.criteriaThreshold ?? config.criteriaThreshold}
                onChange={(e) => handleChange('criteriaThreshold', parseInt(e.target.value) || 0)}
                className={`w-full rounded-md border px-3 py-2 text-sm ${
                  validationErrors.criteriaThreshold
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                    : 'border-neutral-300 focus:border-blue-500 focus:ring-blue-500'
                }`}
              />
              {validationErrors.criteriaThreshold && (
                <p className="mt-1 text-xs text-red-600">{validationErrors.criteriaThreshold}</p>
              )}
            </div>

            {/* Auto-Flag Threshold */}
            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-1">
                {t('review.config.autoFlagThreshold')}
              </label>
              <p className="text-xs text-neutral-500 mb-2">{t('review.config.autoFlagThresholdDesc')}</p>
              <input
                type="number"
                min="1"
                max="10"
                value={formData.autoFlagThreshold ?? config.autoFlagThreshold}
                onChange={(e) => handleChange('autoFlagThreshold', parseInt(e.target.value) || 0)}
                className={`w-full rounded-md border px-3 py-2 text-sm ${
                  validationErrors.autoFlagThreshold
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                    : 'border-neutral-300 focus:border-blue-500 focus:ring-blue-500'
                }`}
              />
              {validationErrors.autoFlagThreshold && (
                <p className="mt-1 text-xs text-red-600">{validationErrors.autoFlagThreshold}</p>
              )}
            </div>

            {/* Variance Limit */}
            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-1">
                {t('review.config.varianceLimit')}
              </label>
              <p className="text-xs text-neutral-500 mb-2">{t('review.config.varianceLimitDesc')}</p>
              <input
                type="number"
                min="0.1"
                max="9.9"
                step="0.1"
                value={formData.varianceLimit ?? config.varianceLimit}
                onChange={(e) => handleChange('varianceLimit', parseFloat(e.target.value) || 0)}
                className={`w-full rounded-md border px-3 py-2 text-sm ${
                  validationErrors.varianceLimit
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                    : 'border-neutral-300 focus:border-blue-500 focus:ring-blue-500'
                }`}
              />
              {validationErrors.varianceLimit && (
                <p className="mt-1 text-xs text-red-600">{validationErrors.varianceLimit}</p>
              )}
            </div>

            {/* Timeout Hours */}
            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-1">
                {t('review.config.timeoutHours')}
              </label>
              <p className="text-xs text-neutral-500 mb-2">{t('review.config.timeoutHoursDesc')}</p>
              <input
                type="number"
                min="1"
                max="72"
                value={formData.timeoutHours ?? config.timeoutHours}
                onChange={(e) => handleChange('timeoutHours', parseInt(e.target.value) || 0)}
                className={`w-full rounded-md border px-3 py-2 text-sm ${
                  validationErrors.timeoutHours
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                    : 'border-neutral-300 focus:border-blue-500 focus:ring-blue-500'
                }`}
              />
              {validationErrors.timeoutHours && (
                <p className="mt-1 text-xs text-red-600">{validationErrors.timeoutHours}</p>
              )}
            </div>

            {/* High-Risk SLA Hours */}
            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-1">
                {t('review.config.highRiskSlaHours')}
              </label>
              <p className="text-xs text-neutral-500 mb-2">{t('review.config.highRiskSlaHoursDesc')}</p>
              <input
                type="number"
                min="1"
                max="48"
                value={formData.highRiskSlaHours ?? config.highRiskSlaHours}
                onChange={(e) => handleChange('highRiskSlaHours', parseInt(e.target.value) || 0)}
                className={`w-full rounded-md border px-3 py-2 text-sm ${
                  validationErrors.highRiskSlaHours
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                    : 'border-neutral-300 focus:border-blue-500 focus:ring-blue-500'
                }`}
              />
              {validationErrors.highRiskSlaHours && (
                <p className="mt-1 text-xs text-red-600">{validationErrors.highRiskSlaHours}</p>
              )}
            </div>

            {/* Medium-Risk SLA Hours */}
            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-1">
                {t('review.config.mediumRiskSlaHours')}
              </label>
              <p className="text-xs text-neutral-500 mb-2">{t('review.config.mediumRiskSlaHoursDesc')}</p>
              <input
                type="number"
                min="1"
                max="168"
                value={formData.mediumRiskSlaHours ?? config.mediumRiskSlaHours}
                onChange={(e) => handleChange('mediumRiskSlaHours', parseInt(e.target.value) || 0)}
                className={`w-full rounded-md border px-3 py-2 text-sm ${
                  validationErrors.mediumRiskSlaHours
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                    : 'border-neutral-300 focus:border-blue-500 focus:ring-blue-500'
                }`}
              />
              {validationErrors.mediumRiskSlaHours && (
                <p className="mt-1 text-xs text-red-600">{validationErrors.mediumRiskSlaHours}</p>
              )}
            </div>

            {/* Deanonymization Access Hours */}
            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-1">
                {t('review.config.deanonymizationAccessHours')}
              </label>
              <p className="text-xs text-neutral-500 mb-2">{t('review.config.deanonymizationAccessHoursDesc')}</p>
              <input
                type="number"
                min="1"
                max="168"
                value={formData.deanonymizationAccessHours ?? config.deanonymizationAccessHours}
                onChange={(e) => handleChange('deanonymizationAccessHours', parseInt(e.target.value) || 0)}
                className={`w-full rounded-md border px-3 py-2 text-sm ${
                  validationErrors.deanonymizationAccessHours
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                    : 'border-neutral-300 focus:border-blue-500 focus:ring-blue-500'
                }`}
              />
              {validationErrors.deanonymizationAccessHours && (
                <p className="mt-1 text-xs text-red-600">{validationErrors.deanonymizationAccessHours}</p>
              )}
            </div>

            {/* Min Message Threshold (Short-chat exclusion) */}
            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-1">
                {t('review.config.minMessageThreshold')}
              </label>
              <p className="text-xs text-neutral-500 mb-2">{t('review.config.minMessageThresholdDesc')}</p>
              <input
                type="number"
                min="1"
                max="100"
                value={formData.minMessageThreshold ?? config.minMessageThreshold ?? 4}
                onChange={(e) => handleChange('minMessageThreshold', parseInt(e.target.value) || 0)}
                className={`w-full rounded-md border px-3 py-2 text-sm ${
                  validationErrors.minMessageThreshold
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                    : 'border-neutral-300 focus:border-blue-500 focus:ring-blue-500'
                }`}
              />
              {validationErrors.minMessageThreshold && (
                <p className="mt-1 text-xs text-red-600">{validationErrors.minMessageThreshold}</p>
              )}
            </div>
          </div>
        </div>

        {/* Supervision Settings */}
        <div className="rounded-lg border border-neutral-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-neutral-800">
            {t('supervision.title') || 'Supervision Settings'}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                {t('groupConfig.supervisionPolicy') || 'Supervision Policy'}
              </label>
              <select
                value={formData.supervisionPolicy ?? config.supervisionPolicy ?? 'none'}
                onChange={(e) => setFormData({ ...formData, supervisionPolicy: e.target.value as any })}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="none">None</option>
                <option value="sampled">Sampled</option>
                <option value="all">All</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                {t('groupConfig.samplePercentage') || 'Sample Percentage'}
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={formData.supervisionSamplePercentage ?? config.supervisionSamplePercentage ?? 100}
                onChange={(e) => handleChange('supervisionSamplePercentage', parseInt(e.target.value) || 0)}
                disabled={formData.supervisionPolicy !== 'sampled'}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500 disabled:opacity-50"
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving || Object.keys(validationErrors).length > 0}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? t('review.common.saving') || 'Saving...' : t('review.config.save')}
          </button>
        </div>
      </form>
    </div>
  );
}
