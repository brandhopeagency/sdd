import { describe, it, expect } from 'vitest';
import {
  evaluateVisibility,
  SurveyQuestionType,
  VisibilityConditionOperator,
  SurveyQuestion,
  SurveyAnswer,
} from './survey';

// Helper to build a minimal SurveyQuestion
function makeQuestion(
  overrides: Partial<SurveyQuestion> & { id: string; order: number },
): SurveyQuestion {
  return {
    type: SurveyQuestionType.FREE_TEXT,
    text: overrides.id,
    required: false,
    options: null,
    validation: null,
    riskFlag: false,
    ...overrides,
  };
}

describe('evaluateVisibility', () => {
  // ── T010 core assertions ──

  it('returns false for a question whose visibilityCondition (legacy) is unmet', () => {
    const q1 = makeQuestion({ id: 'q1', order: 1 });
    const q2 = makeQuestion({
      id: 'q2',
      order: 2,
      visibilityCondition: {
        questionId: 'q1',
        operator: VisibilityConditionOperator.EQUALS,
        value: 'yes',
      },
    });

    const answers: Map<string, SurveyAnswer['value']> = new Map([
      ['q1', 'no'],
    ]);

    const result = evaluateVisibility([q1, q2], answers);

    expect(result.get('q1')).toBe(true);
    expect(result.get('q2')).toBe(false);
  });

  it('required: true on a hidden question does NOT affect the visibility result', () => {
    const q1 = makeQuestion({ id: 'q1', order: 1 });
    const q2 = makeQuestion({
      id: 'q2',
      order: 2,
      required: true, // required flag — must be ignored for visibility
      visibilityCondition: {
        questionId: 'q1',
        operator: VisibilityConditionOperator.EQUALS,
        value: 'yes',
      },
    });

    const answers: Map<string, SurveyAnswer['value']> = new Map([
      ['q1', 'no'],
    ]);

    const result = evaluateVisibility([q1, q2], answers);

    // Hidden means hidden — required flag must not flip visibility to true
    expect(result.get('q2')).toBe(false);
  });

  // ── Bonus coverage ──

  it('empty visibilityConditions array makes the question unconditionally visible', () => {
    const q1 = makeQuestion({ id: 'q1', order: 1, visibilityConditions: [] });

    const result = evaluateVisibility([q1], new Map());

    expect(result.get('q1')).toBe(true);
  });

  it('multi-condition AND: both conditions must be true', () => {
    const q1 = makeQuestion({ id: 'q1', order: 1 });
    const q2 = makeQuestion({ id: 'q2', order: 2 });
    const q3 = makeQuestion({
      id: 'q3',
      order: 3,
      visibilityConditions: [
        { questionId: 'q1', operator: VisibilityConditionOperator.EQUALS, value: 'yes' },
        { questionId: 'q2', operator: VisibilityConditionOperator.EQUALS, value: 'yes' },
      ],
      visibilityConditionCombinator: 'and',
    });

    // Only q1 meets its condition
    const answers: Map<string, SurveyAnswer['value']> = new Map([
      ['q1', 'yes'],
      ['q2', 'no'],
    ]);

    const result = evaluateVisibility([q1, q2, q3], answers);

    expect(result.get('q3')).toBe(false);

    // Both conditions met
    const answersAllYes: Map<string, SurveyAnswer['value']> = new Map([
      ['q1', 'yes'],
      ['q2', 'yes'],
    ]);
    const result2 = evaluateVisibility([q1, q2, q3], answersAllYes);
    expect(result2.get('q3')).toBe(true);
  });

  it('multi-condition OR: at least one condition must be true', () => {
    const q1 = makeQuestion({ id: 'q1', order: 1 });
    const q2 = makeQuestion({ id: 'q2', order: 2 });
    const q3 = makeQuestion({
      id: 'q3',
      order: 3,
      visibilityConditions: [
        { questionId: 'q1', operator: VisibilityConditionOperator.EQUALS, value: 'yes' },
        { questionId: 'q2', operator: VisibilityConditionOperator.EQUALS, value: 'yes' },
      ],
      visibilityConditionCombinator: 'or',
    });

    // Only q1 meets its condition — OR should still show q3
    const answers: Map<string, SurveyAnswer['value']> = new Map([
      ['q1', 'yes'],
      ['q2', 'no'],
    ]);

    const result = evaluateVisibility([q1, q2, q3], answers);

    expect(result.get('q3')).toBe(true);

    // Neither condition met
    const answersNone: Map<string, SurveyAnswer['value']> = new Map([
      ['q1', 'no'],
      ['q2', 'no'],
    ]);
    const result2 = evaluateVisibility([q1, q2, q3], answersNone);
    expect(result2.get('q3')).toBe(false);
  });

  // ── Operator coverage ──

  it('NOT_EQUALS operator: hidden when answer matches, visible when it does not', () => {
    const q1 = makeQuestion({ id: 'q1', order: 1 });
    const q2 = makeQuestion({
      id: 'q2',
      order: 2,
      visibilityCondition: {
        questionId: 'q1',
        operator: VisibilityConditionOperator.NOT_EQUALS,
        value: 'skip',
      },
    });

    const answersMatch: Map<string, SurveyAnswer['value']> = new Map([['q1', 'skip']]);
    const result1 = evaluateVisibility([q1, q2], answersMatch);
    expect(result1.get('q2')).toBe(false);

    const answersNoMatch: Map<string, SurveyAnswer['value']> = new Map([['q1', 'proceed']]);
    const result2 = evaluateVisibility([q1, q2], answersNoMatch);
    expect(result2.get('q2')).toBe(true);
  });

  it('IN operator with single-choice answer: visible when answer is in list', () => {
    const q1 = makeQuestion({ id: 'q1', order: 1 });
    const q2 = makeQuestion({
      id: 'q2',
      order: 2,
      visibilityCondition: {
        questionId: 'q1',
        operator: VisibilityConditionOperator.IN,
        value: ['a', 'b', 'c'],
      },
    });

    const answersIn: Map<string, SurveyAnswer['value']> = new Map([['q1', 'b']]);
    expect(evaluateVisibility([q1, q2], answersIn).get('q2')).toBe(true);

    const answersOut: Map<string, SurveyAnswer['value']> = new Map([['q1', 'd']]);
    expect(evaluateVisibility([q1, q2], answersOut).get('q2')).toBe(false);
  });

  it('IN operator with multi-choice answer: visible if any selected value is in the list', () => {
    const q1 = makeQuestion({ id: 'q1', order: 1, type: SurveyQuestionType.MULTI_CHOICE });
    const q2 = makeQuestion({
      id: 'q2',
      order: 2,
      visibilityCondition: {
        questionId: 'q1',
        operator: VisibilityConditionOperator.IN,
        value: ['red', 'green'],
      },
    });

    // One of the selected values matches — visible
    const answersPartial: Map<string, SurveyAnswer['value']> = new Map([['q1', ['blue', 'green']]]);
    expect(evaluateVisibility([q1, q2], answersPartial).get('q2')).toBe(true);

    // None of the selected values match — hidden
    const answersNone: Map<string, SurveyAnswer['value']> = new Map([['q1', ['blue', 'yellow']]]);
    expect(evaluateVisibility([q1, q2], answersNone).get('q2')).toBe(false);
  });

  it('NOT_IN operator: hidden if any selected value is in the exclusion list', () => {
    const q1 = makeQuestion({ id: 'q1', order: 1, type: SurveyQuestionType.MULTI_CHOICE });
    const q2 = makeQuestion({
      id: 'q2',
      order: 2,
      visibilityCondition: {
        questionId: 'q1',
        operator: VisibilityConditionOperator.NOT_IN,
        value: ['opt1', 'opt2'],
      },
    });

    // Single-choice string: excluded value → hidden
    const q3 = makeQuestion({
      id: 'q3',
      order: 3,
      visibilityCondition: {
        questionId: 'q1',
        operator: VisibilityConditionOperator.NOT_IN,
        value: ['opt1', 'opt2'],
      },
    });

    // Multi-choice with one excluded value → hidden
    const answersHit: Map<string, SurveyAnswer['value']> = new Map([['q1', ['opt2', 'opt3']]]);
    expect(evaluateVisibility([q1, q2], answersHit).get('q2')).toBe(false);

    // Multi-choice with no excluded values → visible
    const answersMiss: Map<string, SurveyAnswer['value']> = new Map([['q1', ['opt3', 'opt4']]]);
    expect(evaluateVisibility([q1, q2], answersMiss).get('q2')).toBe(true);
  });

  it('CONTAINS operator: visible when multi-choice answer includes the expected string', () => {
    const q1 = makeQuestion({ id: 'q1', order: 1, type: SurveyQuestionType.MULTI_CHOICE });
    const q2 = makeQuestion({
      id: 'q2',
      order: 2,
      visibilityCondition: {
        questionId: 'q1',
        operator: VisibilityConditionOperator.CONTAINS,
        value: 'apple',
      },
    });

    const answersContains: Map<string, SurveyAnswer['value']> = new Map([['q1', ['banana', 'apple']]]  );
    expect(evaluateVisibility([q1, q2], answersContains).get('q2')).toBe(true);

    const answersAbsent: Map<string, SurveyAnswer['value']> = new Map([['q1', ['banana', 'mango']]]);
    expect(evaluateVisibility([q1, q2], answersAbsent).get('q2')).toBe(false);
  });

  it('unanswered source question: dependent question is hidden regardless of operator', () => {
    const q1 = makeQuestion({ id: 'q1', order: 1 });
    const q2 = makeQuestion({
      id: 'q2',
      order: 2,
      visibilityCondition: {
        questionId: 'q1',
        operator: VisibilityConditionOperator.EQUALS,
        value: 'yes',
      },
    });

    // q1 is visible but has no answer
    const result = evaluateVisibility([q1, q2], new Map());
    expect(result.get('q1')).toBe(true);
    expect(result.get('q2')).toBe(false);
  });

  it('transitivity: hidden source question causes dependent question to be hidden', () => {
    const q1 = makeQuestion({ id: 'q1', order: 1 });
    // q2 depends on q1 === 'yes' (unmet → q2 is hidden)
    const q2 = makeQuestion({
      id: 'q2',
      order: 2,
      visibilityCondition: {
        questionId: 'q1',
        operator: VisibilityConditionOperator.EQUALS,
        value: 'yes',
      },
    });
    // q3 depends on q2 === 'continue' — but q2 is hidden, so q3 must also be hidden
    const q3 = makeQuestion({
      id: 'q3',
      order: 3,
      visibilityCondition: {
        questionId: 'q2',
        operator: VisibilityConditionOperator.EQUALS,
        value: 'continue',
      },
    });

    const answers: Map<string, SurveyAnswer['value']> = new Map([
      ['q1', 'no'],
      ['q2', 'continue'], // answer is present but q2 is hidden
    ]);

    const result = evaluateVisibility([q1, q2, q3], answers);

    expect(result.get('q1')).toBe(true);
    expect(result.get('q2')).toBe(false);
    expect(result.get('q3')).toBe(false);
  });
});
