import { useMemo } from 'react';
import { SurveyForm as SharedSurveyForm } from '@mentalhelpglobal/chat-frontend-common';
import type { SurveyQuestion } from '@mentalhelpglobal/chat-types';
import { useSurveyGateStore } from '@/stores/surveyGateStore';

interface Props {
  title: string;
  publicHeader?: string | null;
  showReview?: boolean;
  questions: SurveyQuestion[];
  onComplete: () => void;
}

export default function SurveyForm({ title, publicHeader, showReview = true, questions, onComplete }: Props) {
  const {
    currentAnswers,
    setAnswer,
    setFreetext,
    freetextValues,
    submitCurrent,
    savePartial,
    submitting,
    error,
    reviewMode,
    setReviewMode,
    currentQuestionIndex,
    setCurrentQuestionIndex,
    getVisibleQuestions,
  } = useSurveyGateStore();

  const visibleQuestions = useMemo(() => getVisibleQuestions(), [getVisibleQuestions]);

  const handleSubmit = async () => {
    return await submitCurrent();
  };

  const handleSavePartial = async () => {
    await savePartial();
  };

  return (
    <SharedSurveyForm
      title={title}
      publicHeader={publicHeader}
      showReview={showReview}
      questions={questions}
      mode="gate"
      currentAnswers={currentAnswers}
      setAnswer={setAnswer}
      setFreetext={setFreetext}
      freetextValues={freetextValues}
      visibleQuestions={visibleQuestions}
      currentQuestionIndex={currentQuestionIndex}
      setCurrentQuestionIndex={setCurrentQuestionIndex}
      reviewMode={reviewMode}
      setReviewMode={setReviewMode}
      submitting={submitting}
      error={error}
      onSavePartial={handleSavePartial}
      onSubmit={handleSubmit}
      onComplete={onComplete}
    />
  );
}
