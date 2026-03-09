import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { SurveyQuestion, SurveyAnswer } from '@mentalhelpglobal/chat-types';
import { SurveyQuestionType } from '@mentalhelpglobal/chat-types';
import QuestionRenderer from './QuestionRenderer';
import SurveyProgress from './SurveyProgress';

export interface SurveyFormProps {
  title: string;
  publicHeader?: string | null;
  showReview?: boolean;
  questions: SurveyQuestion[];
  mode: 'gate' | 'preview';

  currentAnswers: SurveyAnswer[];
  setAnswer: (questionId: string, value: SurveyAnswer['value']) => void;
  visibleQuestions: SurveyQuestion[];

  currentQuestionIndex: number;
  setCurrentQuestionIndex: (idx: number) => void;
  reviewMode: boolean;
  setReviewMode: (val: boolean) => void;

  submitting: boolean;
  error: string | null;

  /** freetextValues: outer key = questionId, inner key = option label */
  freetextValues?: Record<string, Record<string, string>>;
  setFreetext?: (questionId: string, optionLabel: string, value: string) => void;

  onSavePartial?: () => Promise<void>;
  onSubmit: () => Promise<boolean>;
  onComplete: () => void;
}

export default function SurveyForm({
  title,
  publicHeader,
  showReview = true,
  questions,
  mode,
  currentAnswers,
  setAnswer,
  visibleQuestions,
  currentQuestionIndex,
  setCurrentQuestionIndex,
  reviewMode,
  setReviewMode,
  submitting,
  error: storeError,
  freetextValues,
  setFreetext,
  onSavePartial,
  onSubmit,
  onComplete,
}: SurveyFormProps) {
  const { t } = useTranslation();
  const [validationError, setValidationError] = useState('');
  const prevQuestionsRef = useRef(questions);

  const displayTitle = publicHeader || title;

  useEffect(() => {
    if (prevQuestionsRef.current !== questions) {
      setCurrentQuestionIndex(0);
      setValidationError('');
      setReviewMode(false);
      prevQuestionsRef.current = questions;
    }
  }, [questions, setCurrentQuestionIndex, setReviewMode]);

  const questionIdx = Math.min(currentQuestionIndex, Math.max(visibleQuestions.length - 1, 0));
  const question = visibleQuestions[questionIdx];
  const answer = currentAnswers.find(a => a.questionId === question?.id);
  const isLast = questionIdx === visibleQuestions.length - 1;

  const isAnswered = useCallback((q: SurveyQuestion, ans: SurveyAnswer | undefined): boolean => {
    if (!ans || ans.value === null || ans.value === undefined) return false;
    if (q.type === SurveyQuestionType.FREE_TEXT && typeof ans.value === 'string' && ans.value.trim() === '') return false;
    if (q.type === SurveyQuestionType.MULTI_CHOICE && Array.isArray(ans.value) && ans.value.length === 0) return false;
    return true;
  }, []);

  const handleNext = async () => {
    if (question.required && !isAnswered(question, answer)) {
      setValidationError(t('surveyGate.requiredError'));
      return;
    }
    setValidationError('');
    if (onSavePartial) {
      try { await onSavePartial(); } catch { /* best-effort */ }
    }
    setCurrentQuestionIndex(questionIdx + 1);
  };

  const handleBack = () => {
    setValidationError('');
    setReviewMode(false);
    setCurrentQuestionIndex(Math.max(0, questionIdx - 1));
  };

  const handleLastNext = async () => {
    if (question.required && !isAnswered(question, answer)) {
      setValidationError(t('surveyGate.requiredError'));
      return;
    }
    setValidationError('');
    if (onSavePartial) {
      try { await onSavePartial(); } catch { /* best-effort */ }
    }

    if (showReview) {
      setReviewMode(true);
    } else {
      const ok = await onSubmit();
      if (ok) onComplete();
    }
  };

  const handleSubmit = async () => {
    setValidationError('');
    const ok = await onSubmit();
    if (ok) onComplete();
  };

  const formatAnswer = useCallback((q: SurveyQuestion) => {
    const a = currentAnswers.find((x) => x.questionId === q.id);
    const v = a?.value;
    if (v === null || v === undefined || v === '') return t('surveyGate.noAnswer');
    if (Array.isArray(v)) return v.join(', ') || t('surveyGate.noAnswer');
    if (typeof v === 'boolean') return v ? t('surveyGate.yes') : t('surveyGate.no');
    return String(v);
  }, [currentAnswers, t]);

  if (!question) return null;

  const isPreview = mode === 'preview';

  return (
    <div className={`flex items-center justify-center p-4 ${isPreview ? 'pt-12 pb-0' : 'min-h-screen bg-gradient-to-b from-indigo-50 to-white'}`}>
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-gray-900 mb-1">{displayTitle}</h1>
          {!reviewMode && <SurveyProgress current={questionIdx + 1} total={visibleQuestions.length} />}
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 space-y-6">
          {reviewMode ? (
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-gray-900">{t('surveyGate.reviewTitle')}</h2>
              <div className="space-y-2">
                {visibleQuestions.map((q, idx) => (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => {
                      setReviewMode(false);
                      setValidationError('');
                      setCurrentQuestionIndex(idx);
                    }}
                    className="w-full text-left border rounded-lg p-3 hover:bg-gray-50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs text-gray-500">{t('surveyGate.progress', { current: idx + 1, total: visibleQuestions.length })}</div>
                        <div className="text-sm font-medium text-gray-900 truncate">{q.text}</div>
                        <div className="text-sm text-gray-700 mt-1 break-words">{formatAnswer(q)}</div>
                      </div>
                      <span className="text-xs text-indigo-600 font-medium">{t('surveyGate.edit')}</span>
                    </div>
                  </button>
                ))}
              </div>

              {storeError && <p className="text-sm text-red-600" role="alert">{storeError}</p>}
            </div>
          ) : (
            <div>
              <div className="flex items-start gap-2 mb-4">
                <span className="text-sm font-medium text-indigo-600">#{question.order}</span>
                <p className="text-base text-gray-800 font-medium">{question.text}</p>
                {question.required && <span className="text-red-500 text-sm">*</span>}
              </div>

              <QuestionRenderer
                question={question}
                answer={answer}
                onAnswer={(value) => setAnswer(question.id, value)}
                onFreetext={setFreetext ? (optionLabel, val) => setFreetext(question.id, optionLabel, val) : undefined}
                freetextValues={freetextValues?.[question.id]}
              />

              {(validationError || storeError) && (
                <p className="mt-2 text-sm text-red-600" role="alert">{validationError || storeError}</p>
              )}
            </div>
          )}

          <div className={`flex items-center justify-between pt-4 border-t${isPreview ? ' sticky bottom-0 bg-white' : ''}`}>
            <button
              onClick={handleBack}
              disabled={!reviewMode && questionIdx === 0}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {t('surveyGate.back')}
            </button>

            {reviewMode ? (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {submitting ? t('surveyGate.submitting') : (mode === 'preview' ? t('surveyGate.close', { defaultValue: 'Close' }) : t('surveyGate.submit'))}
              </button>
            ) : isLast ? (
              <button
                onClick={handleLastNext}
                disabled={submitting}
                className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {showReview ? t('surveyGate.review') : (submitting ? t('surveyGate.submitting') : (mode === 'preview' ? t('surveyGate.close', { defaultValue: 'Close' }) : t('surveyGate.submit')))}
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="px-6 py-2 text-sm font-medium text-white bg-indigo-700 rounded-lg hover:bg-indigo-800"
              >
                {t('surveyGate.next')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
