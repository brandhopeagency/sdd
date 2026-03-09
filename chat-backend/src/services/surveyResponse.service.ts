import { getPool } from '../db';
import type { SurveyResponse, PendingSurvey, SurveyAnswer, SurveyQuestion, ChoiceOptionConfig } from '@mentalhelpglobal/chat-types';
import { SurveyQuestionType, REGEX_PRESETS, evaluateVisibility } from '@mentalhelpglobal/chat-types';
import { upsertSurveyMemoryEntry, removeSurveyMemoryEntry } from './agentMemory/agentMemory.service';

function rowToResponse(row: any): SurveyResponse {
  return {
    id: row.id,
    instanceId: row.instance_id,
    pseudonymousId: row.pseudonymous_id,
    groupId: row.group_id ?? null,
    answers: row.answers ?? [],
    startedAt: row.started_at,
    completedAt: row.completed_at ?? null,
    isComplete: row.is_complete,
    invalidatedAt: row.invalidated_at ?? null,
    invalidatedBy: row.invalidated_by ?? null,
    invalidationReason: row.invalidation_reason ?? null,
  } as SurveyResponse;
}

export async function getGateCheck(
  userGroupIds: string[],
  pseudonymousId: string,
): Promise<PendingSurvey[]> {
  if (!userGroupIds || userGroupIds.length === 0) return [];

  const pool = getPool();

  // Inline status transitions for Cloud Run (setInterval unreliable with scale-to-zero)
  await pool.query(
    `UPDATE survey_instances SET status = 'active', updated_at = now()
     WHERE status = 'draft' AND start_date <= now()`,
  );
  await pool.query(
    `UPDATE survey_instances SET status = 'expired', updated_at = now()
     WHERE status = 'active' AND expiration_date <= now()`,
  );

  const result = await pool.query(
    `SELECT si.*, gso.display_order, gso.group_id AS order_group_id
     FROM survey_instances si
     LEFT JOIN group_survey_order gso ON gso.instance_id = si.id AND gso.group_id = ANY($1)
     WHERE si.status = 'active'
       AND si.group_ids && $1
       AND NOT EXISTS (
         SELECT 1 FROM survey_responses sr
         WHERE sr.instance_id = si.id
           AND sr.pseudonymous_id = $2
           AND sr.is_complete = true
           AND sr.invalidated_at IS NULL
       )
     ORDER BY gso.display_order ASC NULLS LAST, si.start_date ASC`,
    [userGroupIds, pseudonymousId],
  );

  const pending: PendingSurvey[] = [];

  for (const row of result.rows) {
    const existingResp = await pool.query(
      'SELECT * FROM survey_responses WHERE instance_id = $1 AND pseudonymous_id = $2 AND invalidated_at IS NULL',
      [row.id, pseudonymousId],
    );

    pending.push({
      instance: {
        id: row.id,
        schemaId: row.schema_id,
        schemaSnapshot: row.schema_snapshot,
        title: row.title,
        status: row.status,
        publicHeader: row.public_header ?? null,
        showReview: row.show_review ?? true,
        groupIds: row.group_ids ?? [],
        startDate: row.start_date,
        expirationDate: row.expiration_date,
        createdBy: row.created_by,
        createdAt: row.created_at,
        closedAt: row.closed_at ?? null,
        updatedAt: row.updated_at,
      },
      existingResponse: existingResp.rows.length > 0
        ? rowToResponse(existingResp.rows[0])
        : null,
    });
  }

  return pending;
}

function validateAnswerType(answer: SurveyAnswer, question: SurveyQuestion): string | null {
  const val = answer.value;
  const qType = question.type as string;
  switch (qType) {
    case SurveyQuestionType.FREE_TEXT:
      if (val !== null && typeof val !== 'string') return `Question ${question.id}: expected string`;
      if (typeof val === 'string' && val.length > 0) {
        const typeErr = validateCanonicalType(val, qType, question);
        if (typeErr) return typeErr;
      }
      break;
    case 'integer_signed':
    case 'integer_unsigned':
    case 'decimal':
    case 'date':
    case 'time':
    case 'datetime':
    case 'email':
    case 'phone':
    case 'url':
    case 'postal_code':
    case 'alphanumeric_code':
    case 'rating_scale':
      if (val !== null && typeof val !== 'string') return `Question ${question.id}: expected string`;
      if (typeof val === 'string' && val.length > 0) {
        const typeErr = validateCanonicalType(val, qType, question);
        if (typeErr) return typeErr;
      }
      break;
    case SurveyQuestionType.SINGLE_CHOICE:
      if (val !== null && typeof val !== 'string') return `Question ${question.id}: expected string`;
      if (typeof val === 'string' && question.options && !question.options.includes(val)) {
        return `Question ${question.id}: invalid option`;
      }
      break;
    case SurveyQuestionType.MULTI_CHOICE:
      if (val !== null && !Array.isArray(val)) return `Question ${question.id}: expected array`;
      if (Array.isArray(val) && question.options) {
        for (const v of val) {
          if (!question.options.includes(v)) return `Question ${question.id}: invalid option "${v}"`;
        }
      }
      break;
    case SurveyQuestionType.BOOLEAN:
      if (val !== null && typeof val !== 'boolean') return `Question ${question.id}: expected boolean`;
      break;
  }
  return null;
}

function validateCanonicalType(val: string, type: string, question: SurveyQuestion): string | null {
  const qid = question.id;
  const validation = (question.validation ?? {}) as any;
  switch (type) {
    case 'integer_signed':
      if (!/^-?\d+$/.test(val)) return `Question ${qid}: expected integer (got "${val}")`;
      if (validation.minValue !== undefined && Number(val) < Number(validation.minValue)) return `Question ${qid}: value below minimum`;
      if (validation.maxValue !== undefined && Number(val) > Number(validation.maxValue)) return `Question ${qid}: value above maximum`;
      break;
    case 'integer_unsigned':
      if (!/^\d+$/.test(val)) return `Question ${qid}: expected non-negative integer (got "${val}")`;
      if (validation.minValue !== undefined && Number(val) < Number(validation.minValue)) return `Question ${qid}: value below minimum`;
      if (validation.maxValue !== undefined && Number(val) > Number(validation.maxValue)) return `Question ${qid}: value above maximum`;
      break;
    case 'decimal':
      if (isNaN(Number(val))) return `Question ${qid}: expected decimal number (got "${val}")`;
      if (validation.minValue !== undefined && Number(val) < Number(validation.minValue)) return `Question ${qid}: value below minimum`;
      if (validation.maxValue !== undefined && Number(val) > Number(validation.maxValue)) return `Question ${qid}: value above maximum`;
      break;
    case 'date':
      if (!/^\d{4}-\d{2}-\d{2}$/.test(val) || isNaN(Date.parse(val)))
        return `Question ${qid}: expected ISO 8601 date (got "${val}")`;
      if (validation.min && val < validation.min) return `Question ${qid}: date is before minimum`;
      if (validation.max && val > validation.max) return `Question ${qid}: date is after maximum`;
      break;
    case 'time':
      if (!/^\d{2}:\d{2}(:\d{2})?$/.test(val))
        return `Question ${qid}: expected time HH:mm (got "${val}")`;
      if (validation.min && val < validation.min) return `Question ${qid}: time is before minimum`;
      if (validation.max && val > validation.max) return `Question ${qid}: time is after maximum`;
      break;
    case 'datetime':
      if (isNaN(Date.parse(val)))
        return `Question ${qid}: expected ISO 8601 datetime (got "${val}")`;
      if (validation.min && val < validation.min) return `Question ${qid}: datetime is before minimum`;
      if (validation.max && val > validation.max) return `Question ${qid}: datetime is after maximum`;
      break;
    case 'rating_scale': {
      const num = Number(val);
      if (isNaN(num)) return `Question ${qid}: expected number for rating scale (got "${val}")`;
      const cfg = question.ratingScaleConfig;
      if (cfg && (num < cfg.startValue || num > cfg.endValue))
        return `Question ${qid}: rating ${val} outside range ${cfg.startValue}-${cfg.endValue}`;
      break;
    }
    case SurveyQuestionType.FREE_TEXT:
      if (validation.minLength !== undefined && val.length < Number(validation.minLength)) return `Question ${qid}: text shorter than minimum length`;
      if (validation.maxLength !== undefined && val.length > Number(validation.maxLength)) return `Question ${qid}: text exceeds maximum length`;
      if (validation.regex && !new RegExp(validation.regex).test(val)) return `Question ${qid}: value does not match validation regex`;
      break;
    case 'email':
    case 'phone':
    case 'url':
    case 'postal_code':
    case 'alphanumeric_code': {
      const pattern = (REGEX_PRESETS as Record<string, string | undefined>)[type];
      if (pattern && !new RegExp(pattern).test(val))
        return `Question ${qid}: value does not match ${type} format`;
      break;
    }
  }
  return null;
}

function validateFreetextValues(answer: SurveyAnswer, question: SurveyQuestion): string | null {
  if (!answer.freetextValues) return null;

  const optionConfigs = question.optionConfigs as ChoiceOptionConfig[] | null | undefined;
  if (!optionConfigs || optionConfigs.length === 0) return null;

  // Determine the selected options
  const selectedOptions: string[] = [];
  if (Array.isArray(answer.value)) {
    for (const v of answer.value) {
      if (typeof v === 'string') selectedOptions.push(v);
    }
  } else if (typeof answer.value === 'string') {
    selectedOptions.push(answer.value);
  }

  // Each key in freetextValues must be a selected option label
  for (const key of Object.keys(answer.freetextValues)) {
    if (!selectedOptions.includes(key)) {
      return `Question ${question.id}: freetextValues key "${key}" is not among selected options`;
    }
  }

  // Validate per-option config
  for (const cfg of optionConfigs) {
    if (!cfg.freetextEnabled) continue;
    if (!selectedOptions.includes(cfg.label)) continue;

    const ftVal = answer.freetextValues[cfg.label];
    const freetextConfig = cfg as { label: string; freetextEnabled: true; freetextType: 'string' | 'number'; freetextRequired?: boolean };

    // Check required
    if (freetextConfig.freetextRequired && (!ftVal || ftVal.trim().length === 0)) {
      return `Question ${question.id}: freetext for option "${cfg.label}" is required`;
    }

    // Validate type if a value was provided
    if (ftVal !== undefined && ftVal !== null && ftVal !== '') {
      if (freetextConfig.freetextType === 'number') {
        if (!Number.isFinite(parseFloat(ftVal))) {
          return `Question ${question.id}: freetext for option "${cfg.label}" must be a valid number`;
        }
      }
    }
  }

  return null;
}

export async function createOrUpdateResponse(
  instanceId: string,
  pseudonymousId: string,
  userGroupIds: string[],
  activeGroupId: string | null,
  answers: SurveyAnswer[],
  isComplete: boolean,
): Promise<SurveyResponse> {
  const pool = getPool();

  const instance = await pool.query('SELECT * FROM survey_instances WHERE id = $1', [instanceId]);
  if (instance.rows.length === 0) {
    const err: any = new Error('Instance not found');
    err.statusCode = 404;
    throw err;
  }

  const row = instance.rows[0];

  if (row.status !== 'active') {
    const err: any = new Error('Survey is not currently accepting responses');
    err.statusCode = 422;
    throw err;
  }

  const instanceGroupIds: string[] = row.group_ids ?? [];
  const hasGroupAccess = userGroupIds.some(gid => instanceGroupIds.includes(gid));
  if (!hasGroupAccess) {
    const err: any = new Error('User does not belong to any target group for this survey');
    err.statusCode = 403;
    throw err;
  }

  const overlap = userGroupIds.filter((gid) => instanceGroupIds.includes(gid));
  const effectiveGroupId =
    (activeGroupId && overlap.includes(activeGroupId)) ? activeGroupId
      : (overlap.length === 1 ? overlap[0] : overlap[0] ?? null);

  if (!effectiveGroupId) {
    const err: any = new Error('Could not resolve group context for this response');
    err.statusCode = 422;
    throw err;
  }

  const snapshot = row.schema_snapshot;
  const questions: SurveyQuestion[] = snapshot?.questions ?? [];

  const answerMap = new Map<string, SurveyAnswer['value']>();
  for (const ans of answers) {
    answerMap.set(ans.questionId, ans.value);
  }

  const visibilityMap = evaluateVisibility(questions, answerMap);

  if (isComplete) {
    const finalAnswers: SurveyAnswer[] = questions.map(q => {
      const isVisible = visibilityMap.get(q.id) ?? true;
      const existing = answers.find(a => a.questionId === q.id);
      if (!isVisible) {
        return { questionId: q.id, value: null, visible: false };
      }
      return { questionId: q.id, value: existing?.value ?? null, visible: true };
    });
    answers = finalAnswers;
  }

  for (const ans of answers) {
    if (ans.visible === false) continue;
    const question = questions.find(q => q.id === ans.questionId);
    if (!question) continue;
    const typeErr = validateAnswerType(ans, question);
    if (typeErr) {
      const err: any = new Error(typeErr);
      err.statusCode = 422;
      (err as any).details = [{ questionId: ans.questionId, type: question.type, submittedValue: ans.value, message: typeErr }];
      throw err;
    }
    const ftErr = validateFreetextValues(ans, question);
    if (ftErr) {
      const err: any = new Error(ftErr);
      err.statusCode = 422;
      (err as any).details = [{ questionId: ans.questionId, type: question.type, submittedValue: ans.value, message: ftErr }];
      throw err;
    }
  }

  if (isComplete) {
    for (const q of questions) {
      const isVisible = visibilityMap.get(q.id) ?? true;
      if (!isVisible) continue;
      if (q.required) {
        const ans = answers.find(a => a.questionId === q.id);
        const hasAnswer = ans &&
          ans.value !== null &&
          ans.value !== '' &&
          !(Array.isArray(ans.value) && ans.value.length === 0);
        if (!hasAnswer) {
          const err: any = new Error(`Required question "${q.text}" is unanswered`);
          err.statusCode = 422;
          throw err;
        }
      }
    }
  }

  const result = await pool.query(
    `INSERT INTO survey_responses (instance_id, pseudonymous_id, group_id, answers, is_complete, completed_at)
     VALUES ($1, $2, $3, $4, $5, ${isComplete ? 'now()' : 'NULL'})
     ON CONFLICT (instance_id, pseudonymous_id)
     DO UPDATE SET
       group_id = COALESCE(survey_responses.group_id, EXCLUDED.group_id),
       answers = CASE WHEN survey_responses.is_complete AND survey_responses.invalidated_at IS NULL
                      THEN survey_responses.answers ELSE EXCLUDED.answers END,
       is_complete = CASE WHEN survey_responses.is_complete AND survey_responses.invalidated_at IS NULL
                          THEN TRUE ELSE EXCLUDED.is_complete END,
       completed_at = CASE WHEN survey_responses.is_complete AND survey_responses.invalidated_at IS NULL
                           THEN survey_responses.completed_at
                           WHEN EXCLUDED.is_complete THEN now() ELSE survey_responses.completed_at END
       ,invalidated_at = CASE WHEN EXCLUDED.is_complete THEN NULL ELSE survey_responses.invalidated_at END
       ,invalidated_by = CASE WHEN EXCLUDED.is_complete THEN NULL ELSE survey_responses.invalidated_by END
       ,invalidation_reason = CASE WHEN EXCLUDED.is_complete THEN NULL ELSE survey_responses.invalidation_reason END
     RETURNING *`,
    [instanceId, pseudonymousId, effectiveGroupId, JSON.stringify(answers), isComplete],
  );

  const saved = rowToResponse(result.rows[0]);

  if (saved.isComplete && row.add_to_memory === true) {
    void upsertSurveyMemoryEntry({
      principalId: pseudonymousId,
      instanceId,
      instanceTitle: row.title,
      schemaSnapshot: snapshot,
      answers: saved.answers,
      completedAt: saved.completedAt,
    }).catch((e) => {
      console.warn('[SurveyResponse] Failed to upsert survey memory:', e);
    });
  }

  return saved;
}

export async function getResponseByInstance(
  instanceId: string,
  pseudonymousId: string,
): Promise<SurveyResponse | null> {
  const pool = getPool();
  const result = await pool.query(
    'SELECT * FROM survey_responses WHERE instance_id = $1 AND pseudonymous_id = $2 AND invalidated_at IS NULL',
    [instanceId, pseudonymousId],
  );
  if (result.rows.length === 0) return null;
  return rowToResponse(result.rows[0]);
}

export async function savePartialProgress(
  responseId: string,
  pseudonymousId: string,
  answers: SurveyAnswer[],
): Promise<SurveyResponse> {
  const pool = getPool();
  const result = await pool.query(
    `UPDATE survey_responses SET answers = $1
     WHERE id = $2 AND pseudonymous_id = $3 AND is_complete = false AND invalidated_at IS NULL
     RETURNING *`,
    [JSON.stringify(answers), responseId, pseudonymousId],
  );
  if (result.rows.length === 0) {
    const err: any = new Error('Response not found or already completed');
    err.statusCode = 404;
    throw err;
  }
  return rowToResponse(result.rows[0]);
}

export async function invalidateInstanceResponses(input: {
  instanceId: string;
  actorId: string;
  reason?: string;
}): Promise<{ affected: number }> {
  const pool = getPool();
  const { instanceId, actorId, reason } = input;
  const res = await pool.query(
    `UPDATE survey_responses
     SET invalidated_at = COALESCE(invalidated_at, now()),
         invalidated_by = $2,
         invalidation_reason = COALESCE($3, invalidation_reason)
     WHERE instance_id = $1`,
    [instanceId, actorId, reason ?? null],
  );

  // Best-effort memory cleanup (async / non-blocking)
  try {
    const inst = await pool.query('SELECT add_to_memory FROM survey_instances WHERE id = $1', [instanceId]);
    if (inst.rows[0]?.add_to_memory === true) {
      const principals = await pool.query(
        'SELECT DISTINCT pseudonymous_id FROM survey_responses WHERE instance_id = $1',
        [instanceId],
      );
      for (const r of principals.rows) {
        const pid = r.pseudonymous_id;
        void removeSurveyMemoryEntry({ principalId: pid, instanceId }).catch(() => undefined);
      }
    }
  } catch (e) {
    console.warn('[SurveyResponse] Failed memory cleanup on instance invalidation:', e);
  }

  return { affected: res.rowCount ?? 0 };
}

export async function invalidateGroupResponses(input: {
  instanceId: string;
  groupId: string;
  actorId: string;
  reason?: string;
}): Promise<{ affected: number }> {
  const pool = getPool();
  const { instanceId, groupId, actorId, reason } = input;
  const res = await pool.query(
    `UPDATE survey_responses
     SET invalidated_at = COALESCE(invalidated_at, now()),
         invalidated_by = $3,
         invalidation_reason = COALESCE($4, invalidation_reason)
     WHERE instance_id = $1 AND group_id = $2`,
    [instanceId, groupId, actorId, reason ?? null],
  );

  // Best-effort memory cleanup (async / non-blocking)
  try {
    const inst = await pool.query('SELECT add_to_memory FROM survey_instances WHERE id = $1', [instanceId]);
    if (inst.rows[0]?.add_to_memory === true) {
      const principals = await pool.query(
        'SELECT DISTINCT pseudonymous_id FROM survey_responses WHERE instance_id = $1 AND group_id = $2',
        [instanceId, groupId],
      );
      for (const r of principals.rows) {
        const pid = r.pseudonymous_id;
        void removeSurveyMemoryEntry({ principalId: pid, instanceId }).catch(() => undefined);
      }
    }
  } catch (e) {
    console.warn('[SurveyResponse] Failed memory cleanup on group invalidation:', e);
  }

  return { affected: res.rowCount ?? 0 };
}

export async function invalidateResponseById(input: {
  responseId: string;
  actorId: string;
  reason?: string;
}): Promise<{ affected: number; pseudonymousId: string | null; instanceId: string | null }> {
  const pool = getPool();
  const { responseId, actorId, reason } = input;
  const res = await pool.query(
    `UPDATE survey_responses
     SET invalidated_at = COALESCE(invalidated_at, now()),
         invalidated_by = $2,
         invalidation_reason = COALESCE($3, invalidation_reason)
     WHERE id = $1
     RETURNING pseudonymous_id, instance_id`,
    [responseId, actorId, reason ?? null],
  );
  if (res.rows.length === 0) return { affected: 0, pseudonymousId: null, instanceId: null };

  const pseudonymousId = res.rows[0].pseudonymous_id ?? null;
  const instanceId = res.rows[0].instance_id ?? null;

  // Best-effort memory cleanup (async / non-blocking)
  if (pseudonymousId && instanceId) {
    try {
      const inst = await pool.query('SELECT add_to_memory FROM survey_instances WHERE id = $1', [instanceId]);
      if (inst.rows[0]?.add_to_memory === true) {
        void removeSurveyMemoryEntry({ principalId: pseudonymousId, instanceId }).catch(() => undefined);
      }
    } catch (e) {
      console.warn('[SurveyResponse] Failed memory cleanup on response invalidation:', e);
    }
  }

  return {
    affected: 1,
    pseudonymousId,
    instanceId,
  };
}
