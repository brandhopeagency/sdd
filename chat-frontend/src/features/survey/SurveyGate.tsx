import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSurveyGateStore } from '@/stores/surveyGateStore';
import SurveyForm from './SurveyForm';

interface Props {
  children: React.ReactNode;
}

export default function SurveyGate({ children }: Props) {
  const { t } = useTranslation();
  const {
    loading,
    gateChecked,
    gateOpen,
    pendingSurveys,
    currentSurveyIndex,
    checkGate,
    advanceToNext,
    error,
  } = useSurveyGateStore();

  useEffect(() => {
    if (!gateChecked) {
      checkGate();
    }
  }, [gateChecked, checkGate]);

  const currentSurvey = pendingSurveys[currentSurveyIndex] ?? null;
  const questions = useMemo(
    () => currentSurvey?.instance.schemaSnapshot?.questions ?? [],
    [currentSurvey],
  );

  if (loading || !gateChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-indigo-50 to-white">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">{t('surveyGate.checking')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-indigo-50 to-white">
        <div className="text-center max-w-md">
          <p className="text-red-600 mb-4" role="alert">{error}</p>
          <button
            onClick={() => checkGate()}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
          >
            {t('surveyGate.retry')}
          </button>
        </div>
      </div>
    );
  }

  if (!gateOpen || !currentSurvey) {
    return <>{children}</>;
  }

  return (
    <SurveyForm
      title={currentSurvey.instance.title}
      publicHeader={currentSurvey.instance.publicHeader}
      showReview={currentSurvey.instance.showReview ?? true}
      questions={questions}
      onComplete={advanceToNext}
    />
  );
}
