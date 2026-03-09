import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';

interface Props {
  onReload: () => void;
  onDismiss: () => void;
}

export default function ConflictNotification({ onReload, onDismiss }: Props) {
  const { t } = useTranslation();

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm bg-amber-50 border border-amber-300 rounded-lg shadow-lg p-4" role="alert">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium text-amber-800">
            {t('survey.conflict.title', { defaultValue: 'Schema updated externally' })}
          </p>
          <p className="text-sm text-amber-700 mt-1">
            {t('survey.conflict.message', { defaultValue: 'Another user has modified this schema. Reload to see their changes, or continue editing (your next save will overwrite).' })}
          </p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={onReload}
              className="px-3 py-1.5 text-xs font-medium text-white bg-amber-600 rounded-md hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              {t('survey.conflict.reload', { defaultValue: 'Reload' })}
            </button>
            <button
              onClick={onDismiss}
              className="px-3 py-1.5 text-xs font-medium text-amber-700 border border-amber-300 rounded-md hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              {t('survey.conflict.continue', { defaultValue: 'Continue editing' })}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
