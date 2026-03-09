/// <reference types="vitest/globals" />

import { vi } from 'vitest';

const mockQuery = vi.fn();

vi.mock('../../src/db', () => ({
  getPool: () => ({ query: mockQuery }),
}));

vi.mock('../../src/services/agentMemory/agentMemory.service', () => ({
  upsertSurveyMemoryEntry: vi.fn(),
  removeSurveyMemoryEntry: vi.fn(),
}));

import { createOrUpdateResponse } from '../../src/services/surveyResponse.service';

describe('surveyResponse.service', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('writes hidden answers with visible=false on completion', async () => {
    const instanceId = 'inst-1';
    const pseudonymousId = 'p-1';
    const q1Id = 'q1';
    const q2Id = 'q2';

    mockQuery
      .mockResolvedValueOnce({
        rows: [{
          id: instanceId,
          status: 'active',
          group_ids: ['g1'],
          schema_snapshot: {
            questions: [
              { id: q1Id, type: 'single_choice', text: 'Q1', required: true, options: ['yes', 'no'] },
              {
                id: q2Id,
                type: 'free_text',
                text: 'Q2',
                required: false,
                visibilityCondition: { questionId: q1Id, operator: 'equals', value: 'yes' },
              },
            ],
          },
          add_to_memory: false,
        }],
      })
      .mockResolvedValueOnce({
        rows: [{
          id: 'resp-1',
          instance_id: instanceId,
          pseudonymous_id: pseudonymousId,
          group_id: 'g1',
          answers: [],
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          is_complete: true,
          invalidated_at: null,
          invalidated_by: null,
          invalidation_reason: null,
        }],
      });

    await createOrUpdateResponse(
      instanceId,
      pseudonymousId,
      ['g1'],
      'g1',
      [{ questionId: q1Id, value: 'no' }],
      true,
    );

    const insertCall = mockQuery.mock.calls[1];
    const savedAnswers = JSON.parse(insertCall[1][3]);
    expect(savedAnswers).toEqual([
      { questionId: q1Id, value: 'no', visible: true },
      { questionId: q2Id, value: null, visible: false },
    ]);
  });

  it('does not require an answer for a required question whose visibility condition is not met', async () => {
    // A question with required: true but visibilityCondition not met should NOT
    // cause a 422 — hidden questions are exempt from required checks.
    const instanceId = 'inst-vis-1';
    const pseudonymousId = 'p-vis-1';
    const q1Id = 'q-choice';
    const q2Id = 'q-hidden-required';

    mockQuery
      .mockResolvedValueOnce({
        rows: [{
          id: instanceId,
          status: 'active',
          group_ids: ['g1'],
          schema_snapshot: {
            questions: [
              { id: q1Id, type: 'single_choice', text: 'Do you smoke?', required: true, options: ['yes', 'no'] },
              {
                id: q2Id,
                type: 'free_text',
                text: 'How many per day?',
                required: true,  // required but will be hidden
                visibilityCondition: { questionId: q1Id, operator: 'equals', value: 'yes' },
              },
            ],
          },
          add_to_memory: false,
        }],
      })
      .mockResolvedValueOnce({
        rows: [{
          id: 'resp-vis-1',
          instance_id: instanceId,
          pseudonymous_id: pseudonymousId,
          group_id: 'g1',
          answers: [],
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          is_complete: true,
          invalidated_at: null,
          invalidated_by: null,
          invalidation_reason: null,
        }],
      });

    // Answer q1 with 'no' — this means q2's visibility condition (equals 'yes') is NOT met,
    // so q2 should be hidden and its required check must be skipped.
    // The call must resolve (HTTP 200 equivalent), not reject.
    await expect(
      createOrUpdateResponse(
        instanceId,
        pseudonymousId,
        ['g1'],
        'g1',
        [{ questionId: q1Id, value: 'no' }],
        true,
      ),
    ).resolves.toBeDefined();

    // Confirm the saved answers mark q2 as hidden (visible: false, value: null)
    const insertCall = mockQuery.mock.calls[1];
    const savedAnswers = JSON.parse(insertCall[1][3]);
    expect(savedAnswers).toEqual([
      { questionId: q1Id, value: 'no', visible: true },
      { questionId: q2Id, value: null, visible: false },
    ]);
  });

  it('enforces numeric min/max constraints for canonical integer type', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'inst-2',
        status: 'active',
        group_ids: ['g1'],
        schema_snapshot: {
          questions: [
            {
              id: 'q-int',
              type: 'integer_unsigned',
              text: 'Age',
              required: true,
              validation: { minValue: 1, maxValue: 120 },
            },
          ],
        },
        add_to_memory: false,
      }],
    });

    await expect(
      createOrUpdateResponse(
        'inst-2',
        'p-2',
        ['g1'],
        'g1',
        [{ questionId: 'q-int', value: '0' }],
        false,
      ),
    ).rejects.toThrow('value below minimum');
  });
});
