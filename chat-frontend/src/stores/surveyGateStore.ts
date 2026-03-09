import { create } from 'zustand';
import type { PendingSurvey, SurveyAnswer, SurveyQuestion } from '@mentalhelpglobal/chat-types';
import { evaluateVisibility } from '@mentalhelpglobal/chat-types';
import { surveyGateApi } from '@/services/surveyApi';

interface SurveyGateState {
  pendingSurveys: PendingSurvey[];
  currentSurveyIndex: number;
  currentAnswers: SurveyAnswer[];
  currentResponseId: string | null;
  loading: boolean;
  submitting: boolean;
  error: string | null;
  gateChecked: boolean;
  gateOpen: boolean;
  reviewMode: boolean;
  visibilityMap: Map<string, boolean>;
  currentQuestionIndex: number;
  /** freetextValues: outer key = questionId, inner key = option label */
  freetextValues: Record<string, Record<string, string>>;

  checkGate: () => Promise<void>;
  setAnswer: (questionId: string, value: SurveyAnswer['value']) => void;
  setFreetext: (questionId: string, optionLabel: string, value: string) => void;
  submitCurrent: () => Promise<boolean>;
  savePartial: () => Promise<void>;
  advanceToNext: () => void;
  setReviewMode: (on: boolean) => void;
  setCurrentQuestionIndex: (index: number) => void;
  reset: () => void;
  getVisibleQuestions: () => SurveyQuestion[];
}

const DRAFT_KEY_PREFIX = 'survey-gate-draft:';

type SurveyDraft = {
  answers: SurveyAnswer[];
  questionIndex: number;
};

function readDraft(instanceId: string): SurveyDraft | null {
  try {
    const raw = window.localStorage.getItem(`${DRAFT_KEY_PREFIX}${instanceId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SurveyDraft;
    if (!Array.isArray(parsed.answers) || typeof parsed.questionIndex !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeDraft(instanceId: string, draft: SurveyDraft): void {
  try {
    window.localStorage.setItem(`${DRAFT_KEY_PREFIX}${instanceId}`, JSON.stringify(draft));
  } catch {
    // Best-effort persistence only.
  }
}

function clearDraft(instanceId: string): void {
  try {
    window.localStorage.removeItem(`${DRAFT_KEY_PREFIX}${instanceId}`);
  } catch {
    // Best-effort cleanup only.
  }
}

function computeVisibility(questions: SurveyQuestion[], answers: SurveyAnswer[]): Map<string, boolean> {
  const answerMap = new Map<string, SurveyAnswer['value']>();
  for (const a of answers) answerMap.set(a.questionId, a.value);
  return evaluateVisibility(questions, answerMap);
}

function getSchemaQuestions(state: { pendingSurveys: PendingSurvey[]; currentSurveyIndex: number }): SurveyQuestion[] {
  const survey = state.pendingSurveys[state.currentSurveyIndex];
  return survey?.instance.schemaSnapshot?.questions ?? [];
}

export const useSurveyGateStore = create<SurveyGateState>((set, get) => ({
  pendingSurveys: [],
  currentSurveyIndex: 0,
  currentAnswers: [],
  currentResponseId: null,
  loading: false,
  submitting: false,
  error: null,
  gateChecked: false,
  gateOpen: false,
  reviewMode: false,
  visibilityMap: new Map(),
  currentQuestionIndex: 0,
  freetextValues: {},

  checkGate: async () => {
    set({ loading: true, error: null });
    const res = await surveyGateApi.gateCheck();
    if (res.success && res.data) {
      const pending = res.data;
      const firstAnswers = pending.length > 0 && pending[0].existingResponse
        ? pending[0].existingResponse.answers
        : [];
      const firstResponseId = pending.length > 0 && pending[0].existingResponse
        ? pending[0].existingResponse.id
        : null;
      const questions = pending[0]?.instance.schemaSnapshot?.questions ?? [];
      const instanceId = pending[0]?.instance.id;
      const draft = instanceId ? readDraft(instanceId) : null;
      const mergedAnswers = draft
        ? [...firstAnswers.filter((a) => !draft.answers.some((d) => d.questionId === a.questionId)), ...draft.answers]
        : firstAnswers;
      const vis = computeVisibility(questions, mergedAnswers);
      set({
        pendingSurveys: pending,
        currentSurveyIndex: 0,
        currentAnswers: mergedAnswers,
        currentResponseId: firstResponseId,
        currentQuestionIndex: Math.max(0, draft?.questionIndex ?? 0),
        loading: false,
        gateChecked: true,
        gateOpen: pending.length > 0,
        reviewMode: false,
        visibilityMap: vis,
      });
    } else {
      set({
        pendingSurveys: [],
        currentSurveyIndex: 0,
        currentAnswers: [],
        currentResponseId: null,
        loading: false,
        gateChecked: true,
        gateOpen: false,
        error: res.error?.message ?? null,
        reviewMode: false,
        visibilityMap: new Map(),
        currentQuestionIndex: 0,
      });
    }
  },

  setAnswer: (questionId, value) => {
    const state = get();
    const answers = [...state.currentAnswers];
    const idx = answers.findIndex(a => a.questionId === questionId);
    if (idx >= 0) {
      answers[idx] = { questionId, value };
    } else {
      answers.push({ questionId, value });
    }

    const questions = getSchemaQuestions(state);
    const oldVis = state.visibilityMap;
    const newVis = computeVisibility(questions, answers);

    const clearedAnswers = answers.filter(a => {
      const wasVisible = oldVis.get(a.questionId) ?? true;
      const isVisible = newVis.get(a.questionId) ?? true;
      return !(wasVisible && !isVisible);
    });

    // Drop freetextValues for questions that just became hidden.
    const newFreetextValues = { ...state.freetextValues };
    for (const [qId] of Object.entries(newFreetextValues)) {
      const wasVisible = oldVis.get(qId) ?? true;
      const isVisible = newVis.get(qId) ?? true;
      if (wasVisible && !isVisible) {
        delete newFreetextValues[qId];
      }
    }

    set({ currentAnswers: clearedAnswers, visibilityMap: newVis, freetextValues: newFreetextValues });

    const active = state.pendingSurveys[state.currentSurveyIndex];
    if (active?.instance?.id) {
      writeDraft(active.instance.id, {
        answers: clearedAnswers,
        questionIndex: state.currentQuestionIndex,
      });
    }
  },

  setFreetext: (questionId, optionLabel, value) => {
    const state = get();
    const existing = state.freetextValues[questionId] ?? {};
    set({
      freetextValues: {
        ...state.freetextValues,
        [questionId]: { ...existing, [optionLabel]: value },
      },
    });
  },

  submitCurrent: async () => {
    const state = get();
    const survey = state.pendingSurveys[state.currentSurveyIndex];
    if (!survey) return false;

    const questions = getSchemaQuestions(state);
    const fullAnswers: SurveyAnswer[] = questions.map(q => {
      const isVisible = state.visibilityMap.get(q.id) ?? true;
      const existing = state.currentAnswers.find(a => a.questionId === q.id);
      const ft = state.freetextValues[q.id];
      if (!isVisible) return { questionId: q.id, value: null, visible: false };
      return {
        questionId: q.id,
        value: existing?.value ?? null,
        visible: true,
        ...(ft && Object.keys(ft).length > 0 ? { freetextValues: ft } : {}),
      };
    });

    set({ submitting: true, error: null });
    const res = await surveyGateApi.submitResponse(survey.instance.id, fullAnswers, true);
    set({ submitting: false });

    if (res.success) {
      clearDraft(survey.instance.id);
      return true;
    } else {
      set({ error: res.error?.message ?? 'Submission failed' });
      return false;
    }
  },

  savePartial: async () => {
    const { currentResponseId, currentAnswers, pendingSurveys, currentSurveyIndex, currentQuestionIndex } = get();
    const survey = pendingSurveys[currentSurveyIndex];
    if (!survey) return;

    if (currentResponseId) {
      await surveyGateApi.savePartial(currentResponseId, currentAnswers);
    } else {
      const res = await surveyGateApi.submitResponse(survey.instance.id, currentAnswers, false);
      if (res.success && res.data) {
        set({ currentResponseId: res.data.id });
      }
    }

    writeDraft(survey.instance.id, {
      answers: currentAnswers,
      questionIndex: currentQuestionIndex,
    });
  },

  advanceToNext: () => {
    const { pendingSurveys, currentSurveyIndex } = get();
    const nextIdx = currentSurveyIndex + 1;
    if (nextIdx < pendingSurveys.length) {
      const next = pendingSurveys[nextIdx];
      const nextAnswers = next.existingResponse?.answers ?? [];
      const questions = next.instance.schemaSnapshot?.questions ?? [];
      const vis = computeVisibility(questions, nextAnswers);
      set({
        currentSurveyIndex: nextIdx,
        currentAnswers: nextAnswers,
        currentResponseId: next.existingResponse?.id ?? null,
        currentQuestionIndex: 0,
        reviewMode: false,
        visibilityMap: vis,
        freetextValues: {},
      });
    } else {
      set({ gateOpen: false, reviewMode: false });
    }
  },

  setReviewMode: (on) => set({ reviewMode: on }),
  setCurrentQuestionIndex: (index) => {
    const state = get();
    const safeIndex = Math.max(0, index);
    set({ currentQuestionIndex: safeIndex });
    const survey = state.pendingSurveys[state.currentSurveyIndex];
    if (survey?.instance?.id) {
      writeDraft(survey.instance.id, {
        answers: state.currentAnswers,
        questionIndex: safeIndex,
      });
    }
  },

  getVisibleQuestions: () => {
    const state = get();
    const questions = getSchemaQuestions(state);
    return questions.filter(q => state.visibilityMap.get(q.id) ?? true);
  },

  reset: () => set({
    pendingSurveys: [],
    currentSurveyIndex: 0,
    currentAnswers: [],
    currentResponseId: null,
    loading: false,
    submitting: false,
    error: null,
    gateChecked: false,
    gateOpen: false,
    reviewMode: false,
    visibilityMap: new Map(),
    currentQuestionIndex: 0,
    freetextValues: {},
  }),
}));
