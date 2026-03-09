import { useTranslation } from 'react-i18next';
import { Check, Loader2, AlertTriangle } from 'lucide-react';
import type { SaveStatus } from '../hooks/useDebouncedSave';

interface Props {
  status: SaveStatus;
  lastSavedAt: Date | null;
  onRetry: () => void;
}

export default function SaveStatusIndicator({ status, lastSavedAt, onRetry }: Props) {
  const { t } = useTranslation();

  if (status === 'idle') return null;

  if (status === 'saving') {
    return (
      <div className="flex items-center gap-1.5 text-sm text-gray-500" role="status" aria-live="polite">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        <span>{t('survey.autosave.saving', { defaultValue: 'Saving...' })}</span>
      </div>
    );
  }

  if (status === 'saved' && lastSavedAt) {
    const timeStr = lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return (
      <div className="flex items-center gap-1.5 text-sm text-green-600" role="status" aria-live="polite">
        <Check className="w-3.5 h-3.5" />
        <span>{t('survey.autosave.saved', { defaultValue: 'Saved' })} {timeStr}</span>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex items-center gap-1.5 text-sm text-red-600" role="status" aria-live="assertive">
        <AlertTriangle className="w-3.5 h-3.5" />
        <span>{t('survey.autosave.failed', { defaultValue: 'Save failed' })}</span>
        <button
          onClick={onRetry}
          className="ml-1 underline font-medium hover:text-red-800 focus:outline-none focus:ring-2 focus:ring-red-500 rounded"
          aria-label={t('survey.autosave.retry', { defaultValue: 'Retry' })}
        >
          {t('survey.autosave.retry', { defaultValue: 'Retry' })}
        </button>
      </div>
    );
  }

  return null;
}
