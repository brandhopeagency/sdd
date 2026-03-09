import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { SurveyQuestion, SurveyAnswer } from '@mentalhelpglobal/chat-types';
import { SurveyQuestionType, evaluateVisibility } from '@mentalhelpglobal/chat-types';

interface Props {
  builtQuestions: SurveyQuestion[];
}

export default function SchemaPreviewPanel({ builtQuestions }: Props) {
  const { t } = useTranslation();
  const [answers, setAnswers] = useState<Map<string, SurveyAnswer['value']>>(new Map());

  const visibilityMap = useMemo(
    () => evaluateVisibility(builtQuestions, answers),
    [builtQuestions, answers],
  );

  const setAnswer = useCallback((questionId: string, value: SurveyAnswer['value']) => {
    setAnswers(prev => {
      const next = new Map(prev);
      next.set(questionId, value);
      return next;
    });
  }, []);

  const visibleCount = Array.from(visibilityMap.values()).filter(Boolean).length;

  return (
    <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">{t('survey.preview.title')}</h3>
        <span className="text-xs text-gray-500">
          {t('survey.preview.visibleCount', { visible: visibleCount, total: builtQuestions.length })}
        </span>
      </div>

      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {builtQuestions.map((q) => {
          const isVisible = visibilityMap.get(q.id) ?? true;
          return (
            <div
              key={q.id}
              className={`p-2 rounded border text-sm ${isVisible ? 'bg-white border-gray-200' : 'bg-gray-100 border-gray-100 opacity-50'}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-gray-400">Q{q.order}</span>
                <span className={`text-sm ${isVisible ? 'text-gray-800' : 'text-gray-400 line-through'}`}>{q.text}</span>
                {!isVisible && <span className="text-xs text-gray-400 italic">{t('survey.preview.hidden')}</span>}
              </div>
              {isVisible && (
                <div className="mt-1">
                  {q.type === SurveyQuestionType.BOOLEAN ? (
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setAnswer(q.id, true)}
                        className={`px-2 py-1 text-xs rounded ${answers.get(q.id) === true ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}>{t('common.yes')}</button>
                      <button type="button" onClick={() => setAnswer(q.id, false)}
                        className={`px-2 py-1 text-xs rounded ${answers.get(q.id) === false ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}>{t('common.no')}</button>
                    </div>
                  ) : q.type === SurveyQuestionType.SINGLE_CHOICE && q.options ? (
                    <select value={(answers.get(q.id) as string) ?? ''} onChange={(e) => setAnswer(q.id, e.target.value || null)}
                      className="px-2 py-1 text-xs border rounded-md w-full">
                      <option value="">--</option>
                      {q.options.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input type="text" value={(answers.get(q.id) as string) ?? ''} onChange={(e) => setAnswer(q.id, e.target.value || null)}
                      placeholder="..." className="px-2 py-1 text-xs border rounded-md w-full" />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button type="button" onClick={() => setAnswers(new Map())}
        className="text-xs text-gray-500 hover:text-gray-700">{t('survey.preview.reset')}</button>
    </div>
  );
}
