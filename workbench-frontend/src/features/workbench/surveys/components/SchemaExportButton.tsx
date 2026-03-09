import { useTranslation } from 'react-i18next';
import { Download } from 'lucide-react';
import type { SurveySchema } from '@mentalhelpglobal/chat-types';
import { downloadSchemaAsJson } from '../utils/schemaExporter';

interface Props {
  schema: SurveySchema;
}

export default function SchemaExportButton({ schema }: Props) {
  const { t } = useTranslation();

  return (
    <button
      onClick={() => downloadSchemaAsJson(schema)}
      className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-700 border rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      aria-label={t('survey.export.button', { defaultValue: 'Export' })}
    >
      <Download className="w-4 h-4" />
      {t('survey.export.button', { defaultValue: 'Export' })}
    </button>
  );
}
