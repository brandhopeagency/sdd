import { useTranslation } from 'react-i18next';
import { SurveyInstanceStatus } from '@mentalhelpglobal/chat-types';

const BADGE_STYLES: Record<SurveyInstanceStatus, string> = {
  [SurveyInstanceStatus.DRAFT]: 'bg-yellow-100 text-yellow-800',
  [SurveyInstanceStatus.ACTIVE]: 'bg-green-100 text-green-800',
  [SurveyInstanceStatus.EXPIRED]: 'bg-red-100 text-red-700',
  [SurveyInstanceStatus.CLOSED]: 'bg-gray-100 text-gray-600',
};

export default function InstanceStatusBadge({ status }: { status: SurveyInstanceStatus }) {
  const { t } = useTranslation();
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${BADGE_STYLES[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {t(`survey.instanceStatus.${status}`)}
    </span>
  );
}
