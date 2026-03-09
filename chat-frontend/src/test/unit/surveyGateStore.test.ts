/// <reference types="vitest/globals" />

/**
 * T012 [US1] — surveyGateStore: visibility & gate-advance tests
 *
 * Verifies that:
 * 1. getVisibleQuestions() excludes a question whose visibilityCondition is not met.
 * 2. submitCurrent() succeeds without a required-field error for questions that
 *    are not visible (they are submitted as { value: null, visible: false }).
 */

import {
  SurveyQuestionType,
  SurveySchemaStatus,
  SurveyInstanceStatus,
  VisibilityConditionOperator,
} from '@mentalhelpglobal/chat-types';
import type { PendingSurvey, SurveyQuestion } from '@mentalhelpglobal/chat-types';

// ---------------------------------------------------------------------------
// Shared question fixtures
// ---------------------------------------------------------------------------

const Q1: SurveyQuestion = {
  id: 'q1',
  order: 1,
  type: SurveyQuestionType.SINGLE_CHOICE,
  text: 'Do you experience anxiety?',
  required: true,
  options: ['Yes', 'No'],
  validation: null,
  riskFlag: false,
};

/** Q2 is only visible when Q1 === 'Yes' */
const Q2: SurveyQuestion = {
  id: 'q2',
  order: 2,
  type: SurveyQuestionType.FREE_TEXT,
  text: 'Describe your anxiety',
  required: true,
  options: null,
  validation: null,
  riskFlag: false,
  visibilityCondition: {
    questionId: 'q1',
    operator: VisibilityConditionOperator.EQUALS,
    value: 'Yes',
  },
};

const Q3: SurveyQuestion = {
  id: 'q3',
  order: 3,
  type: SurveyQuestionType.FREE_TEXT,
  text: 'Any other comments?',
  required: false,
  options: null,
  validation: null,
  riskFlag: false,
};

function makePendingSurvey(questions: SurveyQuestion[]): PendingSurvey {
  return {
    instance: {
      id: 'inst-1',
      schemaId: 'schema-1',
      schemaSnapshot: {
        id: 'schema-1',
        title: 'Test Survey',
        description: null,
        status: SurveySchemaStatus.PUBLISHED,
        questions,
        clonedFromId: null,
        createdBy: 'user-1',
        createdAt: '2026-01-01T00:00:00Z',
        publishedAt: '2026-01-01T00:00:00Z',
        archivedAt: null,
        updatedAt: '2026-01-01T00:00:00Z',
      },
      title: 'Test Survey',
      status: SurveyInstanceStatus.ACTIVE,
      groupIds: [],
      startDate: '2026-01-01T00:00:00Z',
      expirationDate: '2027-01-01T00:00:00Z',
      createdBy: 'user-1',
      createdAt: '2026-01-01T00:00:00Z',
      closedAt: null,
      updatedAt: '2026-01-01T00:00:00Z',
    },
    existingResponse: null,
  };
}

// ---------------------------------------------------------------------------
// Setup helpers — isolate each test via vi.resetModules + vi.doMock
// ---------------------------------------------------------------------------

async function setup(pendingSurveys: PendingSurvey[] = []) {
  vi.resetModules();
  localStorage.clear();

  const submitResponse = vi.fn(async () => ({ success: true, data: { id: 'resp-1' } }));
  const savePartial = vi.fn(async () => ({ success: true }));
  const gateCheck = vi.fn(async () => ({
    success: true,
    data: pendingSurveys,
  }));

  vi.doMock('@/services/surveyApi', () => ({
    surveyGateApi: { gateCheck, submitResponse, savePartial },
  }));

  const mod = await import('../../stores/surveyGateStore');
  const { useSurveyGateStore } = mod;

  return { useSurveyGateStore, submitResponse };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('surveyGateStore — visibility', () => {
  it('getVisibleQuestions excludes question whose condition is not met', async () => {
    const { useSurveyGateStore } = await setup([makePendingSurvey([Q1, Q2, Q3])]);
    const store = useSurveyGateStore.getState();

    // Load surveys via checkGate
    await store.checkGate();

    // Answer Q1 with 'No' — Q2's condition (Q1 === 'Yes') is NOT met
    useSurveyGateStore.getState().setAnswer('q1', 'No');

    const visible = useSurveyGateStore.getState().getVisibleQuestions();
    const ids = visible.map((q) => q.id);

    expect(ids).toContain('q1');
    expect(ids).not.toContain('q2'); // hidden because condition not met
    expect(ids).toContain('q3');
  });

  it('getVisibleQuestions includes question whose condition IS met', async () => {
    const { useSurveyGateStore } = await setup([makePendingSurvey([Q1, Q2, Q3])]);
    await useSurveyGateStore.getState().checkGate();

    // Answer Q1 with 'Yes' — Q2 should now be visible
    useSurveyGateStore.getState().setAnswer('q1', 'Yes');

    const visible = useSurveyGateStore.getState().getVisibleQuestions();
    const ids = visible.map((q) => q.id);

    expect(ids).toContain('q1');
    expect(ids).toContain('q2');
    expect(ids).toContain('q3');
  });
});

describe('surveyGateStore — setFreetext', () => {
  it('sets and accumulates freetext values keyed by questionId → optionLabel', async () => {
    const { useSurveyGateStore } = await setup([makePendingSurvey([Q1, Q2, Q3])]);
    await useSurveyGateStore.getState().checkGate();

    useSurveyGateStore.getState().setFreetext('q1', 'Other', 'some custom text');
    expect(useSurveyGateStore.getState().freetextValues).toEqual({
      q1: { Other: 'some custom text' },
    });

    // Second label on same question accumulates without clearing the first
    useSurveyGateStore.getState().setFreetext('q1', 'AnotherOption', 'more text');
    expect(useSurveyGateStore.getState().freetextValues).toEqual({
      q1: { Other: 'some custom text', AnotherOption: 'more text' },
    });

    // Different question creates its own sub-record
    useSurveyGateStore.getState().setFreetext('q3', 'SpecialOption', 'q3 text');
    expect(useSurveyGateStore.getState().freetextValues).toEqual({
      q1: { Other: 'some custom text', AnotherOption: 'more text' },
      q3: { SpecialOption: 'q3 text' },
    });
  });

  it('clears freetextValues for a question when it becomes hidden via setAnswer', async () => {
    const { useSurveyGateStore } = await setup([makePendingSurvey([Q1, Q2, Q3])]);
    await useSurveyGateStore.getState().checkGate();

    // Q2 is visible when Q1 === 'Yes'
    useSurveyGateStore.getState().setAnswer('q1', 'Yes');
    useSurveyGateStore.getState().setFreetext('q2', 'SomeOption', 'freetext for q2');
    expect(useSurveyGateStore.getState().freetextValues['q2']).toEqual({ SomeOption: 'freetext for q2' });

    // Now change Q1 to 'No' — Q2 becomes hidden → its freetextValues entry must be cleared
    useSurveyGateStore.getState().setAnswer('q1', 'No');
    expect(useSurveyGateStore.getState().freetextValues['q2']).toBeUndefined();
  });
});

describe('surveyGateStore — submitCurrent with hidden required question', () => {
  it('submits successfully without requiring an answer for the hidden question', async () => {
    const { useSurveyGateStore, submitResponse } = await setup([
      makePendingSurvey([Q1, Q2, Q3]),
    ]);
    await useSurveyGateStore.getState().checkGate();

    // Answer Q1 with 'No' (hides Q2) and Q3 is not required
    useSurveyGateStore.getState().setAnswer('q1', 'No');

    const result = await useSurveyGateStore.getState().submitCurrent();

    expect(result).toBe(true);
    expect(submitResponse).toHaveBeenCalledOnce();

    // Q2 must have been submitted with visible: false and value: null
    const callArgs = submitResponse.mock.calls[0] as unknown as [string, Array<{ questionId: string; value: unknown; visible: boolean }>, boolean];
    const submittedAnswers = callArgs[1];
    const q2Answer = submittedAnswers.find((a) => a.questionId === 'q2');
    expect(q2Answer).toBeDefined();
    expect(q2Answer!.visible).toBe(false);
    expect(q2Answer!.value).toBeNull();
  });

  it('submits successfully when visible required question IS answered', async () => {
    const { useSurveyGateStore, submitResponse } = await setup([
      makePendingSurvey([Q1, Q2, Q3]),
    ]);
    await useSurveyGateStore.getState().checkGate();

    useSurveyGateStore.getState().setAnswer('q1', 'Yes');
    useSurveyGateStore.getState().setAnswer('q2', 'I feel anxious often');

    const result = await useSurveyGateStore.getState().submitCurrent();

    expect(result).toBe(true);
    expect(submitResponse).toHaveBeenCalledOnce();

    const callArgs2 = submitResponse.mock.calls[0] as unknown as [string, Array<{ questionId: string; value: unknown; visible: boolean }>, boolean];
    const submittedAnswers = callArgs2[1];
    const q2Answer = submittedAnswers.find((a) => a.questionId === 'q2');
    expect(q2Answer?.visible).toBe(true);
    expect(q2Answer?.value).toBe('I feel anxious often');
  });
});

describe('surveyGateStore — submitCurrent freetextValues in payload', () => {
  it('includes freetextValues in the submission payload for questions that have freetext entries', async () => {
    const { useSurveyGateStore, submitResponse } = await setup([
      makePendingSurvey([Q1, Q2, Q3]),
    ]);
    await useSurveyGateStore.getState().checkGate();

    // Q1 is single_choice with freetext on an option
    useSurveyGateStore.getState().setAnswer('q1', 'Yes');
    useSurveyGateStore.getState().setFreetext('q1', 'Yes', 'clarifying note');

    // Q2 visible (Q1 = 'Yes'), answer it
    useSurveyGateStore.getState().setAnswer('q2', 'I feel anxious often');

    const result = await useSurveyGateStore.getState().submitCurrent();
    expect(result).toBe(true);

    type SubmittedAnswer = { questionId: string; value: unknown; visible: boolean; freetextValues?: Record<string, string> };
    const callArgs = submitResponse.mock.calls[0] as unknown as [string, SubmittedAnswer[], boolean];
    const submittedAnswers = callArgs[1];

    const q1Answer = submittedAnswers.find((a) => a.questionId === 'q1');
    expect(q1Answer).toBeDefined();
    expect(q1Answer!.freetextValues).toEqual({ Yes: 'clarifying note' });

    // Q2 has no freetext configured — freetextValues should be absent from payload
    const q2Answer = submittedAnswers.find((a) => a.questionId === 'q2');
    expect(q2Answer).toBeDefined();
    expect(q2Answer!.freetextValues).toBeUndefined();
  });

  it('omits freetextValues from the payload for hidden questions even if entries exist', async () => {
    const { useSurveyGateStore, submitResponse } = await setup([
      makePendingSurvey([Q1, Q2, Q3]),
    ]);
    await useSurveyGateStore.getState().checkGate();

    // Make Q2 visible, set freetext, then hide it again
    useSurveyGateStore.getState().setAnswer('q1', 'Yes');
    useSurveyGateStore.getState().setFreetext('q2', 'SomeOption', 'phantom text');
    useSurveyGateStore.getState().setAnswer('q1', 'No'); // Q2 hidden, freetextValues['q2'] cleared

    const result = await useSurveyGateStore.getState().submitCurrent();
    expect(result).toBe(true);

    type SubmittedAnswer = { questionId: string; value: unknown; visible: boolean; freetextValues?: Record<string, string> };
    const callArgs = submitResponse.mock.calls[0] as unknown as [string, SubmittedAnswer[], boolean];
    const submittedAnswers = callArgs[1];

    const q2Answer = submittedAnswers.find((a) => a.questionId === 'q2');
    expect(q2Answer).toBeDefined();
    expect(q2Answer!.visible).toBe(false);
    expect(q2Answer!.freetextValues).toBeUndefined();
  });
});
