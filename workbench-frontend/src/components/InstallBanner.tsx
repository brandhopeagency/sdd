import { useTranslation } from 'react-i18next';
import { Download, X, Share } from 'lucide-react';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';

export default function InstallBanner() {
  const { t } = useTranslation();
  const { canInstall, isIOSDevice, promptInstall, dismiss } = useInstallPrompt();

  if (!canInstall) return null;

  return (
    <div className="lg:hidden bg-primary-50 border-b border-primary-200 px-3 sm:px-4 py-2.5 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <Download className="w-4 h-4 text-primary-600 flex-shrink-0" />
        <p className="text-sm text-primary-800 truncate">
          {isIOSDevice
            ? t('pwa.iosTip', 'Tap {{icon}} then "Add to Home Screen"', { icon: '⬆' })
            : t('pwa.installPrompt', 'Install this app for quick access')}
        </p>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {!isIOSDevice && (
          <button
            onClick={() => void promptInstall()}
            className="btn-primary text-xs px-3 py-1.5 min-h-[36px]"
          >
            {t('pwa.install', 'Install')}
          </button>
        )}
        {isIOSDevice && (
          <Share className="w-4 h-4 text-primary-600" />
        )}
        <button
          onClick={dismiss}
          className="p-2 text-primary-500 hover:text-primary-700 rounded-lg min-h-[36px] min-w-[36px] flex items-center justify-center"
          aria-label={t('common.dismiss', 'Dismiss')}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
