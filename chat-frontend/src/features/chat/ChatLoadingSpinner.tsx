import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function ChatLoadingSpinner() {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-center gap-2 p-4 text-muted-foreground text-sm animate-in fade-in duration-300">
      <Loader2 className="w-4 h-4 animate-spin" />
      <span>{t('chat.session.processing', 'Processing...')}</span>
    </div>
  );
}
