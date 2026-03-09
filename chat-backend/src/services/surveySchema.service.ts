import { getPool } from '../db';
import type { SurveySchema, SurveySchemaListItem, SurveyQuestion, SurveyQuestionInput, SchemaExportFormat, SchemaExportV2, ExportQuestionV2 } from '@mentalhelpglobal/chat-types';
import { SurveySchemaStatus, SurveyQuestionType, VisibilityConditionOperator, CURRENT_SCHEMA_EXPORT_VERSION } from '@mentalhelpglobal/chat-types';
import { randomUUID } from 'crypto';

function rowToSchema(row: any): SurveySchema {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? null,
    status: row.status as SurveySchemaStatus,
    questions: row.questions ?? [],
    clonedFromId: row.cloned_from_id ?? null,
    createdBy: row.created_by,
    createdAt: row.created_at,
    publishedAt: row.published_at ?? null,
    archivedAt: row.archived_at ?? null,
    updatedAt: row.updated_at,
  };
}

function rowToListItem(row: any): SurveySchemaListItem {
  const questions = row.questions ?? [];
  return {
    id: row.id,
    title: row.title,
    status: row.status as SurveySchemaStatus,
    questionCount: Array.isArray(questions) ? questions.length : 0,
    createdAt: row.created_at,
    publishedAt: row.published_at ?? null,
    archivedAt: row.archived_at ?? null,
  };
}

const VALID_OPERATORS = new Set(Object.values(VisibilityConditionOperator));
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CHOICE_TYPES = new Set(['single_choice', 'multi_choice']);
const NUMERIC_TYPES = new Set(['integer_signed', 'integer_unsigned', 'decimal']);
const DATE_TIME_TYPES = new Set(['date', 'time', 'datetime']);
const TEXT_VALIDATION_TYPES = new Set([
  'free_text', 'email', 'phone', 'url', 'postal_code', 'alphanumeric_code',
]);
const RATING_TYPE = 'rating_scale';

function validateValidationBlock(q: SurveyQuestionInput): string | null {
  if (!q.validation) return null;
  const type = q.type as string;
  const v = q.validation as any;

  if (TEXT_VALIDATION_TYPES.has(type)) {
    if (v.minValue !== undefined || v.maxValue !== undefined || v.min !== undefined || v.max !== undefined) {
      return 'text-type validation supports text rules only';
    }
    return null;
  }

  if (NUMERIC_TYPES.has(type)) {
    if (v.min !== undefined || v.max !== undefined) return 'numeric question validation cannot include min/max datetime bounds';
    if (v.minLength !== undefined || v.maxLength !== undefined || v.regex !== undefined) {
      return 'numeric question validation cannot include text rules';
    }
    if (v.minValue !== undefined && v.maxValue !== undefined && v.minValue > v.maxValue) {
      return 'validation.minValue must be <= validation.maxValue';
    }
    return null;
  }

  if (DATE_TIME_TYPES.has(type)) {
    if (v.minValue !== undefined || v.maxValue !== undefined) return 'date/time question validation cannot include numeric bounds';
    if (v.minLength !== undefined || v.maxLength !== undefined || v.regex !== undefined) {
      return 'date/time question validation cannot include text rules';
    }
    return null;
  }

  return 'validation is not allowed for this question type';
}

function validateQuestionInput(q: SurveyQuestionInput, allQuestions: SurveyQuestionInput[], index: number): string | null {
  if (!q.text || q.text.trim().length === 0) return 'Question text is required';
  if (q.text.length > 500) return 'Question text must be ≤ 500 characters';

  const type = q.type;
  if (CHOICE_TYPES.has(type as string)) {
    if (!q.options || !Array.isArray(q.options) || q.options.length === 0) {
      return `${type} questions require at least one option`;
    }
  } else {
    if (q.options && Array.isArray(q.options) && q.options.length > 0) {
      return `${type} questions must not have options`;
    }
  }

  const validationError = validateValidationBlock(q);
  if (validationError) {
    return validationError;
  }

  if ((type as string) === RATING_TYPE) {
    if (!q.ratingScaleConfig) return 'ratingScaleConfig is required for rating_scale type';
    const cfg = q.ratingScaleConfig;
    if (typeof cfg.startValue !== 'number' || typeof cfg.endValue !== 'number' || typeof cfg.step !== 'number') {
      return 'ratingScaleConfig startValue, endValue, and step must be numbers';
    }
    if (cfg.endValue <= cfg.startValue) return 'ratingScaleConfig.endValue must be greater than startValue';
    if (cfg.step <= 0) return 'ratingScaleConfig.step must be positive';
    if (!Number.isInteger((cfg.endValue - cfg.startValue) / cfg.step)) {
      return 'ratingScaleConfig range must be evenly divisible by step';
    }
  } else if (q.ratingScaleConfig) {
    return 'ratingScaleConfig is only valid for rating_scale type';
  }

  // Validate visibilityConditionCombinator regardless of whether visibilityConditions is set
  if (q.visibilityConditionCombinator !== undefined &&
      q.visibilityConditionCombinator !== null &&
      q.visibilityConditionCombinator !== 'and' &&
      q.visibilityConditionCombinator !== 'or') {
    return 'visibilityConditionCombinator must be "and" or "or"';
  }

  // Validate visibilityConditions[] (multi-condition, T016 + T022)
  // Note: questionId cross-reference validation (against built IDs) is deferred to
  // validateVisibilityConditions(), which runs after all questions have been built.
  if (q.visibilityConditions && Array.isArray(q.visibilityConditions) && q.visibilityConditions.length > 0) {
    for (let ci = 0; ci < q.visibilityConditions.length; ci++) {
      const cond = q.visibilityConditions[ci];
      if (!cond.questionId) {
        return `visibilityConditions[${ci}].questionId is required`;
      }
      if (!cond.operator || !VALID_OPERATORS.has(cond.operator)) {
        return `visibilityConditions[${ci}]: invalid operator "${cond.operator}"`;
      }
      if (cond.value === undefined || cond.value === null) {
        return `visibilityConditions[${ci}].value is required`;
      }
    }
  }

  // Validate optionConfigs (T026)
  if (q.optionConfigs && Array.isArray(q.optionConfigs) && q.optionConfigs.length > 0) {
    if (!CHOICE_TYPES.has(type as string)) {
      return 'optionConfigs is only allowed on single_choice and multi_choice questions';
    }
    const optionSet = new Set(q.options ?? []);
    for (let oi = 0; oi < q.optionConfigs.length; oi++) {
      const cfg = q.optionConfigs[oi];
      if (!cfg.label) return `optionConfigs[${oi}].label is required`;
      if (!optionSet.has(cfg.label)) {
        return `optionConfigs[${oi}].label "${cfg.label}" does not match any option`;
      }
      if (cfg.freetextEnabled === true) {
        const ft = cfg as { label: string; freetextEnabled: true; freetextType: string };
        if (ft.freetextType !== 'string' && ft.freetextType !== 'number') {
          return `optionConfigs[${oi}].freetextType must be "string" or "number"`;
        }
      } else {
        // Discriminated union: freetextEnabled: false entries must not carry freetextType
        const cfgAny = cfg as any;
        if (cfgAny.freetextType !== undefined) {
          return `optionConfigs[${oi}].freetextType is not allowed when freetextEnabled is false`;
        }
      }
    }
  }

  return null;
}

function validateVisibilityConditions(questions: SurveyQuestionInput[], builtQuestions: SurveyQuestion[]): string | null {
  for (let i = 0; i < questions.length; i++) {
    // Legacy single-condition validation
    const cond = questions[i].visibilityCondition;
    if (cond) {
      if (!cond.questionId) return `Question ${i + 1}: visibilityCondition.questionId is required`;
      if (!cond.operator || !VALID_OPERATORS.has(cond.operator)) {
        return `Question ${i + 1}: invalid visibilityCondition operator`;
      }
      if (cond.value === undefined || cond.value === null) {
        return `Question ${i + 1}: visibilityCondition.value is required`;
      }

      const sourceIdx = builtQuestions.findIndex(q => q.id === cond.questionId);
      if (sourceIdx === -1) {
        const sourceByInputIdx = questions.findIndex((q, j) => j < i && builtQuestions[j]?.id === cond.questionId);
        if (sourceByInputIdx === -1) return `Question ${i + 1}: visibilityCondition references non-existent question`;
      }
      if (sourceIdx >= i) return `Question ${i + 1}: visibilityCondition must reference an earlier question`;
    }

    // Multi-condition validation (T016)
    const conditions = questions[i].visibilityConditions;
    if (conditions && Array.isArray(conditions) && conditions.length > 0) {
      for (let ci = 0; ci < conditions.length; ci++) {
        const mc = conditions[ci];
        if (!mc.questionId) return `Question ${i + 1}: visibilityConditions[${ci}].questionId is required`;
        if (!mc.operator || !VALID_OPERATORS.has(mc.operator)) {
          return `Question ${i + 1}: visibilityConditions[${ci}]: invalid operator "${mc.operator}"`;
        }
        if (mc.value === undefined || mc.value === null) {
          return `Question ${i + 1}: visibilityConditions[${ci}].value is required`;
        }
        const sourceIdx = builtQuestions.findIndex(q => q.id === mc.questionId);
        if (sourceIdx === -1) return `Question ${i + 1}: visibilityConditions[${ci}] references non-existent question`;
        if (sourceIdx >= i) return `Question ${i + 1}: visibilityConditions[${ci}] must reference an earlier question`;
      }
    }
  }
  return null;
}

function stripInvalidConditions(questions: SurveyQuestion[]): SurveyQuestion[] {
  const idSet = new Set(questions.map(q => q.id));
  return questions.map((q, idx) => {
    let result = { ...q };

    // Strip invalid legacy single condition
    if (result.visibilityCondition) {
      const sourceIdx = questions.findIndex(s => s.id === result.visibilityCondition!.questionId);
      if (sourceIdx === -1 || sourceIdx >= idx || !idSet.has(result.visibilityCondition!.questionId)) {
        result = { ...result, visibilityCondition: null };
      }
    }

    // Strip invalid entries from visibilityConditions[]
    if (result.visibilityConditions && Array.isArray(result.visibilityConditions)) {
      const validConditions = result.visibilityConditions.filter(cond => {
        if (!cond.questionId || !idSet.has(cond.questionId)) return false;
        const sourceIdx = questions.findIndex(s => s.id === cond.questionId);
        return sourceIdx !== -1 && sourceIdx < idx;
      });
      result = { ...result, visibilityConditions: validConditions.length > 0 ? validConditions : null };
    }

    return result;
  });
}

function buildQuestion(input: SurveyQuestionInput, order: number, existingId?: string): SurveyQuestion {
  const type = input.type as string;
  return {
    id: existingId ?? randomUUID(),
    order,
    type: input.type,
    text: input.text.trim(),
    required: input.required !== undefined ? input.required : true,
    options: CHOICE_TYPES.has(type)
      ? (input.options ?? [])
      : null,
    validation: input.validation ?? null,
    riskFlag: input.riskFlag ?? false,
    dataType: undefined,
    ratingScaleConfig: type === RATING_TYPE ? (input.ratingScaleConfig ?? null) : null,
    visibilityCondition: input.visibilityCondition ?? null,
    visibilityConditions: input.visibilityConditions ?? null,
    visibilityConditionCombinator: input.visibilityConditionCombinator ?? null,
    optionConfigs: CHOICE_TYPES.has(type) ? (input.optionConfigs ?? null) : null,
  };
}

export async function createSchema(
  title: string,
  description: string | null,
  questionInputs: SurveyQuestionInput[],
  createdBy: string,
): Promise<SurveySchema> {
  const pool = getPool();

  if (!title || title.trim().length === 0) {
    const err: any = new Error('title is required');
    err.statusCode = 422;
    throw err;
  }
  if (title.length > 200) {
    const err: any = new Error('title must be ≤ 200 characters');
    err.statusCode = 422;
    throw err;
  }

  const questions: SurveyQuestion[] = [];
  for (let i = 0; i < questionInputs.length; i++) {
    const validationError = validateQuestionInput(questionInputs[i], questionInputs, i);
    if (validationError) {
      const err: any = new Error(validationError);
      err.statusCode = 422;
      throw err;
    }
    questions.push(buildQuestion(questionInputs[i], i + 1));
  }

  const condError = validateVisibilityConditions(questionInputs, questions);
  if (condError) {
    const err: any = new Error(condError);
    err.statusCode = 422;
    throw err;
  }

  const cleanedQuestions = stripInvalidConditions(questions);

  const result = await pool.query(
    `INSERT INTO survey_schemas (title, description, questions, created_by)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [title.trim(), description ?? null, JSON.stringify(cleanedQuestions), createdBy],
  );

  return rowToSchema(result.rows[0]);
}

export async function getSchemaById(id: string): Promise<SurveySchema | null> {
  const pool = getPool();
  const result = await pool.query('SELECT * FROM survey_schemas WHERE id = $1', [id]);
  if (result.rows.length === 0) return null;
  return rowToSchema(result.rows[0]);
}

export async function listSchemas(statusFilter?: string): Promise<SurveySchemaListItem[]> {
  const pool = getPool();
  let sql = 'SELECT * FROM survey_schemas';
  const values: unknown[] = [];

  if (statusFilter === 'archived') {
    sql += ' WHERE status = $1';
    values.push('archived');
  } else if (statusFilter) {
    sql += ' WHERE status = $1';
    values.push(statusFilter);
  } else {
    sql += " WHERE status != 'archived'";
  }
  sql += ' ORDER BY created_at DESC';

  const result = await pool.query(sql, values);
  return result.rows.map(rowToListItem);
}

export async function updateSchema(
  id: string,
  updates: { title?: string; description?: string; questions?: SurveyQuestionInput[] },
): Promise<SurveySchema> {
  const pool = getPool();

  const current = await pool.query('SELECT * FROM survey_schemas WHERE id = $1', [id]);
  if (current.rows.length === 0) {
    const err: any = new Error('Schema not found');
    err.statusCode = 404;
    throw err;
  }

  if (current.rows[0].status !== 'draft') {
    const err: any = new Error('Only draft schemas can be edited');
    err.statusCode = 403;
    throw err;
  }

  const sets: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;

  if (updates.title !== undefined) {
    if (updates.title.trim().length === 0) {
      const err: any = new Error('title is required');
      err.statusCode = 422;
      throw err;
    }
    if (updates.title.length > 200) {
      const err: any = new Error('title must be ≤ 200 characters');
      err.statusCode = 422;
      throw err;
    }
    sets.push(`title = $${idx++}`);
    vals.push(updates.title.trim());
  }

  if (updates.description !== undefined) {
    sets.push(`description = $${idx++}`);
    vals.push(updates.description);
  }

  if (updates.questions !== undefined) {
    const questions: SurveyQuestion[] = [];
    for (let i = 0; i < updates.questions.length; i++) {
      const validationError = validateQuestionInput(updates.questions[i], updates.questions, i);
      if (validationError) {
        const err: any = new Error(validationError);
        err.statusCode = 422;
        throw err;
      }
      const incomingId: unknown = (updates.questions[i] as any).id;
      const existingId = (typeof incomingId === 'string' && UUID_RE.test(incomingId))
        ? incomingId
        : undefined;
      questions.push(buildQuestion(updates.questions[i], i + 1, existingId));
    }

    const seenIds = new Set<string>();
    for (const q of questions) {
      if (seenIds.has(q.id)) {
        const err: any = new Error('Duplicate question id in request');
        err.statusCode = 422;
        throw err;
      }
      seenIds.add(q.id);
    }

    const existingQuestions: SurveyQuestion[] = current.rows[0].questions ?? [];
    const oldIdToIdx = new Map(existingQuestions.map((q, i) => [q.id, i]));
    for (const q of questions) {
      if (q.visibilityCondition?.questionId) {
        const srcIdx = oldIdToIdx.get(q.visibilityCondition.questionId);
        if (srcIdx !== undefined && srcIdx < questions.length) {
          q.visibilityCondition.questionId = questions[srcIdx].id;
        }
      }
      if (q.visibilityConditions && Array.isArray(q.visibilityConditions)) {
        for (const cond of q.visibilityConditions) {
          if (cond.questionId) {
            const srcIdx = oldIdToIdx.get(cond.questionId);
            if (srcIdx !== undefined && srcIdx < questions.length) {
              cond.questionId = questions[srcIdx].id;
            }
          }
        }
      }
    }

    const condError = validateVisibilityConditions(updates.questions, questions);
    if (condError) {
      const err: any = new Error(condError);
      err.statusCode = 422;
      throw err;
    }
    const cleanedQuestions = stripInvalidConditions(questions);
    sets.push(`questions = $${idx++}`);
    vals.push(JSON.stringify(cleanedQuestions));
  }

  if (sets.length === 0) {
    return rowToSchema(current.rows[0]);
  }

  sets.push(`updated_at = now()`);
  vals.push(id);

  const result = await pool.query(
    `UPDATE survey_schemas SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
    vals,
  );

  return rowToSchema(result.rows[0]);
}

export async function publishSchema(id: string): Promise<SurveySchema> {
  const pool = getPool();

  const current = await pool.query('SELECT * FROM survey_schemas WHERE id = $1', [id]);
  if (current.rows.length === 0) {
    const err: any = new Error('Schema not found');
    err.statusCode = 404;
    throw err;
  }

  if (current.rows[0].status !== 'draft') {
    const err: any = new Error('Only draft schemas can be published');
    err.statusCode = 403;
    throw err;
  }

  const questions = current.rows[0].questions ?? [];
  if (!Array.isArray(questions) || questions.length === 0) {
    const err: any = new Error('Schema must have at least one question to publish');
    err.statusCode = 422;
    throw err;
  }

  const result = await pool.query(
    `UPDATE survey_schemas
     SET status = 'published', published_at = now(), updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [id],
  );

  return rowToSchema(result.rows[0]);
}

export async function archiveSchema(id: string): Promise<SurveySchema> {
  const pool = getPool();
  const current = await pool.query('SELECT * FROM survey_schemas WHERE id = $1', [id]);
  if (current.rows.length === 0) {
    const err: any = new Error('Schema not found');
    err.statusCode = 404;
    throw err;
  }
  if (current.rows[0].status !== 'published') {
    const err: any = new Error('Only published schemas can be archived');
    err.statusCode = 403;
    throw err;
  }
  const result = await pool.query(
    `UPDATE survey_schemas SET status = 'archived', archived_at = now(), updated_at = now() WHERE id = $1 RETURNING *`,
    [id],
  );
  return rowToSchema(result.rows[0]);
}

export async function restoreSchema(id: string): Promise<SurveySchema> {
  const pool = getPool();
  const current = await pool.query('SELECT * FROM survey_schemas WHERE id = $1', [id]);
  if (current.rows.length === 0) {
    const err: any = new Error('Schema not found');
    err.statusCode = 404;
    throw err;
  }
  if (current.rows[0].status !== 'archived') {
    const err: any = new Error('Only archived schemas can be restored');
    err.statusCode = 403;
    throw err;
  }
  const previousStatus = current.rows[0].published_at ? 'published' : 'draft';
  const result = await pool.query(
    `UPDATE survey_schemas SET status = $2, archived_at = NULL, updated_at = now() WHERE id = $1 RETURNING *`,
    [id, previousStatus],
  );
  return rowToSchema(result.rows[0]);
}

export async function cloneSchema(id: string, createdBy: string): Promise<SurveySchema> {
  const pool = getPool();
  const current = await pool.query('SELECT * FROM survey_schemas WHERE id = $1', [id]);
  if (current.rows.length === 0) {
    const err: any = new Error('Schema not found');
    err.statusCode = 404;
    throw err;
  }

  const sourceQuestions: SurveyQuestion[] = current.rows[0].questions ?? [];
  const clonedQuestions = sourceQuestions.map((q, i) => ({
    ...q,
    id: randomUUID(),
    order: i + 1,
  }));

  const result = await pool.query(
    `INSERT INTO survey_schemas (title, description, questions, cloned_from_id, created_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      `${current.rows[0].title} (copy)`,
      current.rows[0].description,
      JSON.stringify(clonedQuestions),
      id,
      createdBy,
    ],
  );

  return rowToSchema(result.rows[0]);
}

export async function deleteSchema(id: string): Promise<void> {
  const pool = getPool();
  const current = await pool.query('SELECT * FROM survey_schemas WHERE id = $1', [id]);
  if (current.rows.length === 0) {
    const err: any = new Error('Schema not found');
    err.statusCode = 404;
    throw err;
  }
  if (current.rows[0].status !== 'draft') {
    const err: any = new Error('Only draft schemas can be deleted');
    err.statusCode = 403;
    throw err;
  }
  const instances = await pool.query(
    'SELECT id FROM survey_instances WHERE schema_id = $1 LIMIT 1',
    [id],
  );
  if (instances.rows.length > 0) {
    const err: any = new Error('Cannot delete schema with existing instances');
    err.statusCode = 409;
    throw err;
  }
  await pool.query('DELETE FROM survey_schemas WHERE id = $1', [id]);
}

export async function exportSchema(id: string): Promise<SchemaExportV2> {
  const pool = getPool();
  const result = await pool.query('SELECT * FROM survey_schemas WHERE id = $1', [id]);
  if (result.rows.length === 0) {
    const err: any = new Error('Schema not found');
    err.statusCode = 404;
    throw err;
  }

  const schema = rowToSchema(result.rows[0]);
  const exportQuestions: ExportQuestionV2[] = schema.questions.map(q => ({
    id: q.id,
    order: q.order,
    type: q.type,
    text: q.text,
    required: q.required,
    options: q.options,
    validation: q.validation,
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
    questions: exportQuestions,
  };
}

export async function importSchema(
  body: SchemaExportFormat,
  createdBy: string,
): Promise<SurveySchema> {
  const pool = getPool();
  const errors: { field: string; message: string }[] = [];

  if (body.schemaVersion === undefined || body.schemaVersion === null || typeof body.schemaVersion !== 'number') {
    errors.push({ field: 'schemaVersion', message: 'schemaVersion is required and must be a number' });
  } else if (body.schemaVersion > CURRENT_SCHEMA_EXPORT_VERSION) {
    errors.push({ field: 'schemaVersion', message: `schemaVersion ${body.schemaVersion} is not supported (max: ${CURRENT_SCHEMA_EXPORT_VERSION})` });
  }

  if (!body.title || typeof body.title !== 'string' || body.title.trim().length === 0) {
    errors.push({ field: 'title', message: 'title is required' });
  } else if (body.title.length > 200) {
    errors.push({ field: 'title', message: 'title must be ≤ 200 characters' });
  }

  if (!Array.isArray(body.questions)) {
    errors.push({ field: 'questions', message: 'questions must be an array' });
  }

  if (errors.length > 0) {
    const err: any = new Error('Import validation failed');
    err.statusCode = 422;
    err.details = errors;
    throw err;
  }

  const isV2 = body.schemaVersion === 2;

  const questionInputs: SurveyQuestionInput[] = body.questions.map(q => {
    const input: SurveyQuestionInput = {
      type: q.type,
      text: q.text,
      required: q.required,
      options: q.options,
      validation: q.validation,
      riskFlag: q.riskFlag,
      ratingScaleConfig: q.ratingScaleConfig,
      visibilityCondition: q.visibilityCondition,
      visibilityConditions: isV2 ? ((q as any).visibilityConditions ?? null) : null,
      visibilityConditionCombinator: isV2 ? ((q as any).visibilityConditionCombinator ?? null) : null,
      optionConfigs: isV2 ? ((q as any).optionConfigs ?? null) : null,
    };
    return input;
  });

  const questions: SurveyQuestion[] = [];
  for (let i = 0; i < questionInputs.length; i++) {
    const validationError = validateQuestionInput(questionInputs[i], questionInputs, i);
    if (validationError) {
      errors.push({ field: `questions[${i}]`, message: validationError });
    }
    const q = body.questions[i];
    const qInput = questionInputs[i];
    questions.push({
      id: q.id || randomUUID(),
      order: q.order ?? i + 1,
      type: q.type,
      text: q.text.trim(),
      required: q.required !== undefined ? q.required : true,
      options: CHOICE_TYPES.has(q.type as string) ? (q.options ?? []) : null,
      validation: q.validation ?? null,
      riskFlag: q.riskFlag ?? false,
      dataType: undefined,
      ratingScaleConfig: q.type === (RATING_TYPE as any) ? (q.ratingScaleConfig ?? null) : null,
      visibilityCondition: q.visibilityCondition ?? null,
      visibilityConditions: isV2 ? (qInput.visibilityConditions ?? null) : null,
      visibilityConditionCombinator: isV2 ? (qInput.visibilityConditionCombinator ?? null) : null,
      optionConfigs: isV2 ? (qInput.optionConfigs ?? null) : null,
    });
  }

  if (errors.length === 0) {
    const condError = validateVisibilityConditions(questionInputs, questions);
    if (condError) {
      errors.push({ field: 'questions.visibilityCondition', message: condError });
    }
  }

  if (errors.length > 0) {
    const err: any = new Error('Import validation failed');
    err.statusCode = 422;
    err.details = errors;
    throw err;
  }

  const cleanedQuestions = stripInvalidConditions(questions);

  const result = await pool.query(
    `INSERT INTO survey_schemas (title, description, questions, created_by)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [body.title.trim(), body.description ?? null, JSON.stringify(cleanedQuestions), createdBy],
  );

  return rowToSchema(result.rows[0]);
}
