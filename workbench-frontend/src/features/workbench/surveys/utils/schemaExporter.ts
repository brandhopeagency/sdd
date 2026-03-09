import type { SurveySchema, SchemaExportFormat, ExportQuestion } from '@mentalhelpglobal/chat-types';
import { CURRENT_SCHEMA_EXPORT_VERSION } from '@mentalhelpglobal/chat-types';

function toSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

export function schemaToExportFormat(schema: SurveySchema): SchemaExportFormat {
  const questions: ExportQuestion[] = schema.questions.map(q => ({
    id: q.id,
    order: q.order,
    type: q.type,
    text: q.text,
    required: q.required,
    options: q.options,
    validation: q.validation ?? null,
    ratingScaleConfig: q.ratingScaleConfig ?? null,
    visibilityCondition: q.visibilityCondition ?? null,
    visibilityConditions: q.visibilityConditions ?? null,
    visibilityConditionCombinator: q.visibilityConditionCombinator ?? null,
    optionConfigs: q.optionConfigs ?? null,
    riskFlag: q.riskFlag,
  }));

  return {
    schemaVersion: CURRENT_SCHEMA_EXPORT_VERSION,
    title: schema.title,
    description: schema.description,
    questions,
  };
}

export function downloadSchemaAsJson(schema: SurveySchema): void {
  const exportData = schemaToExportFormat(schema);
  const json = JSON.stringify(exportData, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const slug = toSlug(schema.title) || 'survey-schema';
  const date = new Date().toISOString().split('T')[0];
  const filename = `survey-schema-${slug}-${date}.json`;

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
