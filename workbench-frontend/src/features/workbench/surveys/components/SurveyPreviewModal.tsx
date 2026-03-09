import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { SurveyForm } from '@mentalhelpglobal/chat-frontend-common';
import type { SurveyQuestion, SurveyAnswer } from '@mentalhelpglobal/chat-types';
import { evaluateVisibility } from '@mentalhelpglobal/chat-types';
import { X } from 'lucide-react';

interface Props {
  questions: SurveyQuestion[];
  title: string;
  onClose: () => void;
}

export default function SurveyPreviewModal({ questions, title, onClose }: Props) {
  const { t } = useTranslation();
  const [answers, setAnswers] = useState<SurveyAnswer[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [reviewMode, setReviewMode] = useState(false);

  const setAnswer = useCallback((questionId: string, value: SurveyAnswer['value']) => {
    setAnswers(prev => {
      const existing = prev.findIndex(a => a.questionId === questionId);
      const newAnswer: SurveyAnswer = { questionId, value };
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = newAnswer;
        return updated;
      }
      return [...prev, newAnswer];
    });
  }, []);

  const visibleQuestions = useMemo(() => {
    const answerMap = new Map<string, SurveyAnswer['value']>();
    for (const a of answers) {
      answerMap.set(a.questionId, a.value);
    }
    const visibility = evaluateVisibility(questions, answerMap);
    return questions.filter(q => visibility.get(q.id) !== false);
  }, [questions, answers]);

  const handleSubmit = useCallback(async () => {
    onClose();
    return true;
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-gradient-to-b from-indigo-50 to-white rounded-2xl shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
          aria-label={t('survey.preview.exit', { defaultValue: 'Exit Preview' })}
        >
          <X className="w-5 h-5" />
        </button>

        <div className="absolute top-4 left-4 z-10">
          <span className="px-2 py-1 text-xs font-medium text-indigo-700 bg-indigo-100 rounded-full">
            {t('survey.preview.badge', { defaultValue: 'Preview Mode' })}
          </span>
        </div>

        <SurveyForm
          title={title}
          showReview={true}
          questions={questions}
          mode="preview"
          currentAnswers={answers}
          setAnswer={setAnswer}
          visibleQuestions={visibleQuestions}
          currentQuestionIndex={questionIndex}
          setCurrentQuestionIndex={setQuestionIndex}
          reviewMode={reviewMode}
          setReviewMode={setReviewMode}
          submitting={false}
          error={null}
          onSubmit={handleSubmit}
          onComplete={onClose}
        />
      </div>
    </div>
  );
}
