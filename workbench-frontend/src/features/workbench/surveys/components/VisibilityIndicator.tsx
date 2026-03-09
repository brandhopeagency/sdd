import { useTranslation } from 'react-i18next';
import { Eye } from 'lucide-react';
import type { VisibilityCondition } from '@mentalhelpglobal/chat-types';

interface Props {
  condition: VisibilityCondition | null | undefined;
  sourceQuestionOrder?: number;
}

export default function VisibilityIndicator({ condition, sourceQuestionOrder }: Props) {
  const { t } = useTranslation();
  if (!condition) return null;

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-indigo-700 bg-indigo-100 rounded-full"
      title={t('survey.condition.dependsOn', { order: sourceQuestionOrder ?? '?' })}
    >
      <Eye className="w-3 h-3" />
      {t('survey.condition.dependsOnShort', { order: sourceQuestionOrder ?? '?' })}
    </span>
  );
}
