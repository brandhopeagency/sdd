import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Download } from 'lucide-react';

interface SurveyDownloadButtonProps {
  instanceId: string;
  onDownload: (instanceId: string, format: 'json' | 'csv') => void;
}

export default function SurveyDownloadButton({ instanceId, onDownload }: SurveyDownloadButtonProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const handleSelect = (format: 'json' | 'csv') => {
    onDownload(instanceId, format);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="p-1.5 rounded-md text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
        aria-label="Download"
      >
        <Download className="w-4 h-4" />
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-36 bg-white border border-neutral-200 rounded-lg shadow-lg z-10 py-1">
          <button
            onClick={() => handleSelect('json')}
            className="w-full text-left px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
          >
            {t('survey.groupSurveys.downloadJson')}
          </button>
          <button
            onClick={() => handleSelect('csv')}
            className="w-full text-left px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
          >
            {t('survey.groupSurveys.downloadCsv')}
          </button>
        </div>
      )}
    </div>
  );
}
