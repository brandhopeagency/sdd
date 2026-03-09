import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useSupervisionStore } from '@/stores/supervisionStore';
import { useReviewStore } from '@/stores/reviewStore';
import ReviewerAssessmentColumn from './components/ReviewerAssessmentColumn';
import SupervisorCommentPanel from './components/SupervisorCommentPanel';
import type { SupervisorDecisionInput } from '@mentalhelpglobal/chat-types';

export default function SupervisorReviewView() {
  const { sessionReviewId } = useParams<{ sessionReviewId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'transcript' | 'assessment' | 'decision'>('transcript');

  const {
    supervisionContext,
    contextLoading,
    error,
    fetchContext,
    submitDecision,
    clearContext,
  } = useSupervisionStore();

  const { selectSession, sessionMessages, sessionLoading } = useReviewStore();

  useEffect(() => {
    if (sessionReviewId) {
      fetchContext(sessionReviewId);
    }
    return () => clearContext();
  }, [sessionReviewId, fetchContext, clearContext]);

  // Load session messages once we have the session ID from context
  useEffect(() => {
    if (supervisionContext?.review?.session_id) {
      selectSession(supervisionContext.review.session_id);
    }
  }, [supervisionContext?.review?.session_id, selectSession]);

  const handleSubmit = async (input: SupervisorDecisionInput) => {
    if (!sessionReviewId) return;
    setSubmitting(true);
    try {
      await submitDecision(sessionReviewId, input);
      navigate('/workbench/review');
    } catch {
      setSubmitting(false);
    }
  };

  if (contextLoading || sessionLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error || !supervisionContext) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error || t('supervision.contextNotFound')}</p>
          <button
            onClick={() => navigate('/workbench/review')}
            className="text-blue-600 hover:underline"
          >
            {t('common.back')}
          </button>
        </div>
      </div>
    );
  }

  const { review, ratings, priorDecisions } = supervisionContext;
  const currentIteration = priorDecisions.length > 0
    ? Math.max(...priorDecisions.map((d) => d.revisionIteration)) + 1
    : 1;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <button
          onClick={() => navigate('/workbench/review')}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-semibold">{t('supervision.title')}</h2>
        <span className="text-sm text-gray-500">
          {t('supervision.iteration')} {currentIteration}
        </span>
      </div>

      {/* Tabbed navigation for md screens */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 lg:hidden">
        {(['transcript', 'assessment', 'decision'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t(`supervision.tab.${tab}`)}
          </button>
        ))}
      </div>

      {/* 3-column layout on lg+, single panel on smaller */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 min-h-0 overflow-hidden">
        {/* Column 1: Chat transcript */}
        <div className={`border-r border-gray-200 dark:border-gray-700 overflow-y-auto ${activeTab !== 'transcript' ? 'hidden lg:block' : ''}`}>
          <div className="p-4">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              {t('supervision.chatTranscript')}
            </h3>
            <div className="space-y-3">
              {sessionMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-3 rounded-lg text-sm ${
                    msg.role === 'user'
                      ? 'bg-blue-50 dark:bg-blue-900/20 ml-4'
                      : 'bg-gray-50 dark:bg-gray-800/50 mr-4'
                  }`}
                >
                  <div className="text-xs font-medium text-gray-500 mb-1 capitalize">
                    {msg.role}
                  </div>
                  <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                </div>
              ))}
              {sessionMessages.length === 0 && (
                <p className="text-gray-400 text-sm italic">{t('supervision.noMessages')}</p>
              )}
            </div>
          </div>
        </div>

        {/* Column 2: Reviewer's assessment */}
        <div className={`border-r border-gray-200 dark:border-gray-700 overflow-hidden ${activeTab !== 'assessment' ? 'hidden lg:block' : ''}`}>
          <ReviewerAssessmentColumn review={review} ratings={ratings} />
        </div>

        {/* Column 3: Supervisor comment panel */}
        <div className={`overflow-hidden ${activeTab !== 'decision' ? 'hidden lg:block' : ''}`}>
          <SupervisorCommentPanel
            priorDecisions={priorDecisions}
            currentIteration={currentIteration}
            onSubmit={handleSubmit}
            submitting={submitting}
          />
        </div>
      </div>
    </div>
  );
}
