/// <reference types="vitest/globals" />

import { vi } from 'vitest';

const mockQuery = vi.fn();

vi.mock('../../src/db', () => ({
  getPool: () => ({ query: mockQuery }),
}));

import {
  createSchema,
  getSchemaById,
  listSchemas,
  updateSchema,
  publishSchema,
  archiveSchema,
  restoreSchema,
  deleteSchema,
  cloneSchema,
  exportSchema,
} from '../../src/services/surveySchema.service';
import type { SurveyQuestion } from '@mentalhelpglobal/chat-types';
import { SurveyQuestionType, VisibilityConditionOperator } from '@mentalhelpglobal/chat-types';

const DRAFT_ROW = {
  id: 'schema-1',
  title: 'Test Schema',
  description: null,
  status: 'draft',
  cloned_from_id: null,
  created_by: 'user-1',
  created_at: '2026-01-01T00:00:00Z',
  published_at: null,
  archived_at: null,
  updated_at: '2026-01-01T00:00:00Z',
};

function makeChoiceQuestion(id: string, order: number): SurveyQuestion {
  return {
    id,
    order,
    type: SurveyQuestionType.SINGLE_CHOICE,
    text: `Question ${order}`,
    required: true,
    options: ['Yes', 'No'],
    validation: null,
    riskFlag: false,
    ratingScaleConfig: null,
    visibilityCondition: null,
    visibilityConditions: null,
    visibilityConditionCombinator: null,
    optionConfigs: null,
  };
}

describe('surveySchema.service — updateSchema', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('preserves existing question IDs on PATCH so visibilityCondition survives a second save', async () => {
    const q1Id = 'aaaaaaaa-0000-0000-0000-000000000001';
    const q2Id = 'aaaaaaaa-0000-0000-0000-000000000002';

    const dbQuestions: SurveyQuestion[] = [
      makeChoiceQuestion(q1Id, 1),
      {
        ...makeChoiceQuestion(q2Id, 2),
        visibilityCondition: {
          questionId: q1Id,
          operator: VisibilityConditionOperator.EQUALS,
          value: 'Yes',
        },
      },
    ];

    // Both SELECT (fetch current) and UPDATE (save) queries
    mockQuery
      .mockResolvedValueOnce({ rows: [{ ...DRAFT_ROW, questions: dbQuestions }] })
      .mockResolvedValueOnce({ rows: [{ ...DRAFT_ROW, questions: dbQuestions, updated_at: '2026-01-02T00:00:00Z' }] });

    // Frontend sends questions back with their known IDs (as any).id
    const result = await updateSchema('schema-1', {
      questions: [
        { ...(dbQuestions[0] as any) },
        { ...(dbQuestions[1] as any) },
      ],
    });

    expect(result).toBeDefined();
    // Check the questions written to DB still carry the original IDs
    const savedJson = JSON.parse(mockQuery.mock.calls[1][1][0] as string) as SurveyQuestion[];
    expect(savedJson[0].id).toBe(q1Id);
    expect(savedJson[1].id).toBe(q2Id);
    expect(savedJson[1].visibilityCondition?.questionId).toBe(q1Id);
  });

  it('generates a new UUID for questions that arrive without an id', async () => {
    const q1Id = 'bbbbbbbb-0000-0000-0000-000000000001';
    const dbQuestions: SurveyQuestion[] = [makeChoiceQuestion(q1Id, 1)];

    mockQuery
      .mockResolvedValueOnce({ rows: [{ ...DRAFT_ROW, questions: dbQuestions }] })
      .mockResolvedValueOnce({ rows: [{ ...DRAFT_ROW, questions: dbQuestions, updated_at: '2026-01-02T00:00:00Z' }] });

    await updateSchema('schema-1', {
      questions: [
        // Send without id — simulates a newly added question
        { type: SurveyQuestionType.SINGLE_CHOICE, text: 'New question', required: true, options: ['A', 'B'] },
      ],
    });

    const savedJson = JSON.parse(mockQuery.mock.calls[1][1][0] as string) as SurveyQuestion[];
    expect(savedJson[0].id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(savedJson[0].id).not.toBe(q1Id);
  });

  it('rejects a PATCH with duplicate question IDs', async () => {
    const q1Id = 'cccccccc-0000-0000-0000-000000000001';
    const dbQuestions: SurveyQuestion[] = [makeChoiceQuestion(q1Id, 1)];

    mockQuery.mockResolvedValueOnce({ rows: [{ ...DRAFT_ROW, questions: dbQuestions }] });

    await expect(
      updateSchema('schema-1', {
        questions: [
          { ...(dbQuestions[0] as any) },
          { ...(dbQuestions[0] as any), text: 'Duplicate id question' }, // same id
        ],
      }),
    ).rejects.toMatchObject({ message: 'Duplicate question id in request', statusCode: 422 });
  });

  it('rejects a non-UUID client-supplied id and generates a fresh UUID instead', async () => {
    const q1Id = 'dddddddd-0000-0000-0000-000000000001';
    const dbQuestions: SurveyQuestion[] = [makeChoiceQuestion(q1Id, 1)];

    mockQuery
      .mockResolvedValueOnce({ rows: [{ ...DRAFT_ROW, questions: dbQuestions }] })
      .mockResolvedValueOnce({ rows: [{ ...DRAFT_ROW, questions: dbQuestions, updated_at: '2026-01-02T00:00:00Z' }] });

    await updateSchema('schema-1', {
      questions: [
        { type: SurveyQuestionType.SINGLE_CHOICE, text: 'Q', required: true, options: ['A'], id: 'not-a-uuid' } as any,
      ],
    });

    const savedJson = JSON.parse(mockQuery.mock.calls[1][1][0] as string) as SurveyQuestion[];
    expect(savedJson[0].id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(savedJson[0].id).not.toBe('not-a-uuid');
  });

  it('second save with stale frontend IDs no longer 422s (regression guard)', async () => {
    const q1Id = 'eeeeeeee-0000-0000-0000-000000000001';
    const q2Id = 'eeeeeeee-0000-0000-0000-000000000002';

    const dbAfterFirstSave: SurveyQuestion[] = [
      makeChoiceQuestion(q1Id, 1),
      {
        ...makeChoiceQuestion(q2Id, 2),
        visibilityCondition: {
          questionId: q1Id,
          operator: VisibilityConditionOperator.EQUALS,
          value: 'Yes',
        },
        optionConfigs: [{ label: 'Yes', freetextEnabled: true, freetextType: 'string' as const }],
      },
    ];

    // Second save: DB already has the IDs from the first save; frontend still sends the same IDs
    mockQuery
      .mockResolvedValueOnce({ rows: [{ ...DRAFT_ROW, questions: dbAfterFirstSave }] })
      .mockResolvedValueOnce({ rows: [{ ...DRAFT_ROW, questions: dbAfterFirstSave, updated_at: '2026-01-03T00:00:00Z' }] });

    await expect(
      updateSchema('schema-1', {
        questions: [
          { ...(dbAfterFirstSave[0] as any) },
          { ...(dbAfterFirstSave[1] as any) },
        ],
      }),
    ).resolves.toBeDefined();
  });
});

describe('surveySchema.service — createSchema', () => {
  beforeEach(() => mockQuery.mockReset());

  it('creates a schema with questions and returns the row', async () => {
    const row = { ...DRAFT_ROW, questions: [] };
    mockQuery.mockResolvedValueOnce({ rows: [row] });

    const result = await createSchema('My Survey', null, [], 'user-1');
    expect(result.title).toBe('Test Schema');
    expect(result.status).toBe('draft');
  });

  it('422s when title is empty', async () => {
    await expect(createSchema('', null, [], 'user-1'))
      .rejects.toMatchObject({ statusCode: 422, message: 'title is required' });
  });

  it('422s when question type is invalid for optionConfigs', async () => {
    await expect(
      createSchema('T', null, [
        { type: SurveyQuestionType.FREE_TEXT, text: 'Q', required: true, optionConfigs: [{ label: 'X', freetextEnabled: true, freetextType: 'string' }] },
      ], 'user-1'),
    ).rejects.toMatchObject({ statusCode: 422 });
  });
});

describe('surveySchema.service — getSchemaById', () => {
  beforeEach(() => mockQuery.mockReset());

  it('returns null when schema not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    expect(await getSchemaById('missing-id')).toBeNull();
  });

  it('returns the schema when found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ ...DRAFT_ROW, questions: [] }] });
    const result = await getSchemaById('schema-1');
    expect(result?.id).toBe('schema-1');
  });
});

describe('surveySchema.service — listSchemas', () => {
  beforeEach(() => mockQuery.mockReset());

  it('returns mapped list items', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ ...DRAFT_ROW, questions: [] }] });
    const list = await listSchemas();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('schema-1');
  });

  it('applies archived filter', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await listSchemas('archived');
    const sql: string = mockQuery.mock.calls[0][0];
    expect(sql).toContain("WHERE status = $1");
  });
});

describe('surveySchema.service — publishSchema', () => {
  beforeEach(() => mockQuery.mockReset());

  it('422s when schema has no questions', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ ...DRAFT_ROW, questions: [] }] });
    await expect(publishSchema('schema-1'))
      .rejects.toMatchObject({ statusCode: 422 });
  });

  it('404s when schema not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(publishSchema('missing'))
      .rejects.toMatchObject({ statusCode: 404 });
  });

  it('publishes successfully when schema has questions', async () => {
    const q = makeChoiceQuestion('q1', 1);
    mockQuery
      .mockResolvedValueOnce({ rows: [{ ...DRAFT_ROW, questions: [q] }] })
      .mockResolvedValueOnce({ rows: [{ ...DRAFT_ROW, status: 'published', questions: [q], published_at: '2026-01-02T00:00:00Z' }] });
    const result = await publishSchema('schema-1');
    expect(result.status).toBe('published');
  });
});

describe('surveySchema.service — deleteSchema', () => {
  beforeEach(() => mockQuery.mockReset());

  it('404s when schema not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(deleteSchema('missing'))
      .rejects.toMatchObject({ statusCode: 404 });
  });

  it('403s when schema is not draft', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ ...DRAFT_ROW, status: 'published' }] });
    await expect(deleteSchema('schema-1'))
      .rejects.toMatchObject({ statusCode: 403 });
  });

  it('409s when schema has existing instances', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ ...DRAFT_ROW }] })
      .mockResolvedValueOnce({ rows: [{ id: 'inst-1' }] });
    await expect(deleteSchema('schema-1'))
      .rejects.toMatchObject({ statusCode: 409 });
  });

  it('deletes successfully when no instances', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ ...DRAFT_ROW }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    await expect(deleteSchema('schema-1')).resolves.toBeUndefined();
  });
});

describe('surveySchema.service — cloneSchema', () => {
  beforeEach(() => mockQuery.mockReset());

  it('404s when schema not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(cloneSchema('missing', 'user-1'))
      .rejects.toMatchObject({ statusCode: 404 });
  });

  it('creates a cloned schema with new IDs', async () => {
    const q = makeChoiceQuestion('orig-uuid', 1);
    const cloneRow = { ...DRAFT_ROW, id: 'clone-schema', title: 'Test Schema (copy)', questions: [] };
    mockQuery
      .mockResolvedValueOnce({ rows: [{ ...DRAFT_ROW, questions: [q] }] })
      .mockResolvedValueOnce({ rows: [cloneRow] });
    const result = await cloneSchema('schema-1', 'user-1');
    expect(result.id).toBe('clone-schema');
    // The INSERT should have been called with a new UUID for the question (not orig-uuid)
    const insertedQuestions = JSON.parse(mockQuery.mock.calls[1][1][2] as string);
    expect(insertedQuestions[0].id).not.toBe('orig-uuid');
  });
});

describe('surveySchema.service — archiveSchema', () => {
  beforeEach(() => mockQuery.mockReset());

  it('404s when not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(archiveSchema('x')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('403s when not published', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ ...DRAFT_ROW, status: 'draft' }] });
    await expect(archiveSchema('schema-1')).rejects.toMatchObject({ statusCode: 403 });
  });

  it('archives a published schema', async () => {
    const archivedRow = { ...DRAFT_ROW, status: 'archived', archived_at: '2026-01-02T00:00:00Z' };
    mockQuery
      .mockResolvedValueOnce({ rows: [{ ...DRAFT_ROW, status: 'published' }] })
      .mockResolvedValueOnce({ rows: [archivedRow] });
    const result = await archiveSchema('schema-1');
    expect(result.status).toBe('archived');
  });
});

describe('surveySchema.service — restoreSchema', () => {
  beforeEach(() => mockQuery.mockReset());

  it('404s when not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(restoreSchema('x')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('403s when not archived', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ ...DRAFT_ROW, status: 'published' }] });
    await expect(restoreSchema('schema-1')).rejects.toMatchObject({ statusCode: 403 });
  });

  it('restores an archived schema to draft when no published_at', async () => {
    const restoredRow = { ...DRAFT_ROW, status: 'draft' };
    mockQuery
      .mockResolvedValueOnce({ rows: [{ ...DRAFT_ROW, status: 'archived', published_at: null }] })
      .mockResolvedValueOnce({ rows: [restoredRow] });
    const result = await restoreSchema('schema-1');
    expect(result.status).toBe('draft');
  });

  it('restores to published when published_at is set', async () => {
    const restoredRow = { ...DRAFT_ROW, status: 'published', published_at: '2026-01-01T00:00:00Z' };
    mockQuery
      .mockResolvedValueOnce({ rows: [{ ...DRAFT_ROW, status: 'archived', published_at: '2026-01-01T00:00:00Z' }] })
      .mockResolvedValueOnce({ rows: [restoredRow] });
    const result = await restoreSchema('schema-1');
    expect(result.status).toBe('published');
  });
});

describe('surveySchema.service — exportSchema', () => {
  beforeEach(() => mockQuery.mockReset());

  it('404s when not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(exportSchema('x')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('returns export format with questions', async () => {
    const q = makeChoiceQuestion('q1', 1);
    mockQuery.mockResolvedValueOnce({ rows: [{ ...DRAFT_ROW, questions: [q] }] });
    const result = await exportSchema('schema-1');
    expect(result.title).toBe('Test Schema');
    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].id).toBe('q1');
  });
});

describe('surveySchema.service — updateSchema error paths', () => {
  beforeEach(() => mockQuery.mockReset());

  it('404s when schema not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(updateSchema('missing', { title: 'New' }))
      .rejects.toMatchObject({ statusCode: 404 });
  });

  it('403s when schema is not draft', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ ...DRAFT_ROW, status: 'published' }] });
    await expect(updateSchema('schema-1', { title: 'New' }))
      .rejects.toMatchObject({ statusCode: 403 });
  });

  it('422s on empty title', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ ...DRAFT_ROW }] });
    await expect(updateSchema('schema-1', { title: '  ' }))
      .rejects.toMatchObject({ statusCode: 422 });
  });
});
