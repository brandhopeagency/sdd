import { getPool } from '../db';
import type { SurveyQuestion, SurveyAnswer } from '@mentalhelpglobal/chat-types';

interface ExportResult {
  contentType: string;
  filename: string;
  data: string;
}

export async function exportResponses(
  instanceId: string,
  groupId: string,
  format: 'json' | 'csv',
): Promise<ExportResult> {
  const pool = getPool();

  const instResult = await pool.query(
    'SELECT schema_snapshot, title FROM survey_instances WHERE id = $1',
    [instanceId],
  );
  if (instResult.rows.length === 0) {
    const err: any = new Error('Instance not found');
    err.statusCode = 404;
    throw err;
  }

  const schemaSnapshot = instResult.rows[0].schema_snapshot;
  const instanceTitle: string = instResult.rows[0].title;
  const questions: SurveyQuestion[] = schemaSnapshot?.questions ?? [];

  const respResult = await pool.query(
    `SELECT pseudonymous_id, completed_at, answers
     FROM survey_responses
     WHERE instance_id = $1
       AND group_id = $2
       AND is_complete = true
       AND invalidated_at IS NULL
     ORDER BY completed_at ASC`,
    [instanceId, groupId],
  );

  const safeTitle = instanceTitle.replace(/[^a-zA-Z0-9_-]/g, '_');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  if (format === 'json') {
    const rows = respResult.rows.map((r: any) => ({
      pseudonymousId: r.pseudonymous_id,
      completedAt: r.completed_at instanceof Date ? r.completed_at.toISOString() : r.completed_at,
      answers: (r.answers as SurveyAnswer[]).map(a => ({
        questionId: a.questionId,
        value: a.value,
        visible: a.visible ?? true,
      })),
    }));

    return {
      contentType: 'application/json',
      filename: `${safeTitle}_${timestamp}.json`,
      data: JSON.stringify(rows, null, 2),
    };
  }

  const answerMap = (answers: SurveyAnswer[]): Map<string, SurveyAnswer> => {
    const m = new Map<string, SurveyAnswer>();
    for (const a of answers) m.set(a.questionId, a);
    return m;
  };

  const headerCols = ['pseudonymousId', 'completedAt'];
  for (const q of questions) {
    headerCols.push(q.text);
    headerCols.push(`${q.text}_visible`);
  }

  const csvRows: string[] = [headerCols.map(escapeCsv).join(',')];

  for (const r of respResult.rows) {
    const aMap = answerMap(r.answers as SurveyAnswer[]);
    const completedAtStr = r.completed_at instanceof Date ? r.completed_at.toISOString() : String(r.completed_at ?? '');
    const cols: string[] = [
      escapeCsv(r.pseudonymous_id),
      escapeCsv(completedAtStr),
    ];
    for (const q of questions) {
      const ans = aMap.get(q.id);
      const val = ans?.value;
      const visible = ans?.visible ?? true;
      cols.push(escapeCsv(formatCsvValue(val)));
      cols.push(escapeCsv(String(visible)));
    }
    csvRows.push(cols.join(','));
  }

  return {
    contentType: 'text/csv',
    filename: `${safeTitle}_${timestamp}.csv`,
    data: csvRows.join('\n'),
  };
}

function formatCsvValue(val: string | string[] | boolean | null | undefined): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'boolean') return String(val);
  if (Array.isArray(val)) return val.join('; ');
  return String(val);
}

function escapeCsv(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}
