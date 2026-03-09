import { useTranslation } from 'react-i18next';
import { SurveySchemaStatus } from '@mentalhelpglobal/chat-types';

const BADGE_STYLES: Record<SurveySchemaStatus, string> = {
  [SurveySchemaStatus.DRAFT]: 'bg-yellow-100 text-yellow-800',
  [SurveySchemaStatus.PUBLISHED]: 'bg-green-100 text-green-800',
  [SurveySchemaStatus.ARCHIVED]: 'bg-gray-100 text-gray-600',
};

export default function SchemaStatusBadge({ status }: { status: SurveySchemaStatus }) {
  const { t } = useTranslation();
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${BADGE_STYLES[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {t(`survey.status.${status}`)}
    </span>
  );
}
