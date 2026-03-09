import type { SurveySchema, SchemaExportFormat } from '@mentalhelpglobal/chat-types';
import { CURRENT_SCHEMA_EXPORT_VERSION } from '@mentalhelpglobal/chat-types';
import { surveySchemaApi } from '@/services/surveyApi';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export interface ImportValidationError {
  field: string;
  message: string;
}

export interface ImportResult {
  success: boolean;
  schema?: SurveySchema;
  errors?: ImportValidationError[];
}

function validateClientSide(data: any): ImportValidationError[] {
  const errors: ImportValidationError[] = [];

  if (data.schemaVersion === undefined || data.schemaVersion === null) {
    errors.push({ field: 'schemaVersion', message: 'schemaVersion is required' });
  } else if (typeof data.schemaVersion !== 'number') {
    errors.push({ field: 'schemaVersion', message: 'schemaVersion must be a number' });
  } else if (data.schemaVersion > CURRENT_SCHEMA_EXPORT_VERSION) {
    errors.push({ field: 'schemaVersion', message: `schemaVersion ${data.schemaVersion} is not supported (max: ${CURRENT_SCHEMA_EXPORT_VERSION})` });
  }

  if (!data.title || typeof data.title !== 'string' || data.title.trim().length === 0) {
    errors.push({ field: 'title', message: 'title is required' });
  }

  if (!Array.isArray(data.questions)) {
    errors.push({ field: 'questions', message: 'questions must be an array' });
  }

  return errors;
}

export async function importSchemaFromFile(file: File): Promise<ImportResult> {
  if (file.size > MAX_FILE_SIZE) {
    return { success: false, errors: [{ field: 'file', message: `File exceeds maximum size of 5 MB (${(file.size / 1024 / 1024).toFixed(1)} MB)` }] };
  }

  let text: string;
  try {
    text = await file.text();
  } catch {
    return { success: false, errors: [{ field: 'file', message: 'Failed to read file' }] };
  }

  let data: SchemaExportFormat;
  try {
    data = JSON.parse(text);
  } catch {
    return { success: false, errors: [{ field: 'file', message: 'File is not valid JSON' }] };
  }

  const clientErrors = validateClientSide(data);
  if (clientErrors.length > 0) {
    return { success: false, errors: clientErrors };
  }

  const result = await surveySchemaApi.import(data);
  if (result.success && result.data) {
    return { success: true, schema: result.data };
  }

  const serverErrors: ImportValidationError[] = (result as any).details ??
    [{ field: 'server', message: result.error?.message ?? 'Import failed' }];
  return { success: false, errors: serverErrors };
}
