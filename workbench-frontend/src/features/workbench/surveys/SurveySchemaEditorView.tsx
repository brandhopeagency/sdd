import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SurveySchemaStatus } from '@mentalhelpglobal/chat-types';
import type { SurveyQuestionInput } from '@mentalhelpglobal/chat-types';
import { useSurveyStore } from '@/stores/surveyStore';
import QuestionList from './components/QuestionList';
import PublishConfirmModal from './components/PublishConfirmModal';
import SchemaPreviewPanel from './components/SchemaPreviewPanel';
import SchemaStatusBadge from './components/SchemaStatusBadge';
import SaveStatusIndicator from './components/SaveStatusIndicator';
import ConflictNotification from './components/ConflictNotification';
import SurveyPreviewModal from './components/SurveyPreviewModal';
import SchemaExportButton from './components/SchemaExportButton';
import { useDebouncedSave } from './hooks/useDebouncedSave';
import { ArrowLeft, Copy, Eye, Play } from 'lucide-react';

export default function SurveySchemaEditorView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { currentSchema, currentSchemaLoading, fetchSchema, publishSchema, cloneSchema } = useSurveyStore();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<SurveyQuestionInput[]>([]);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  const isDraft = currentSchema?.status === SurveySchemaStatus.DRAFT;
  const isReadOnly = !isDraft;

  const {
    saveStatus,
    lastSavedAt,
    conflict,
    retrySave,
    dismissConflict,
    hasUnsavedChanges,
  } = useDebouncedSave({
    schemaId: id,
    isReadOnly,
    title,
    description,
    questions,
    loadedSchema: currentSchema,
  });

  useEffect(() => {
    if (id) fetchSchema(id);
  }, [id, fetchSchema]);

  useEffect(() => {
    if (currentSchema) {
      setTitle(currentSchema.title);
      setDescription(currentSchema.description ?? '');
      setQuestions(currentSchema.questions.map(q => Object.assign({
        type: q.type,
        text: q.text,
        required: q.required,
        options: q.options,
        validation: q.validation,
        riskFlag: q.riskFlag,
        dataType: q.dataType,
        ratingScaleConfig: q.ratingScaleConfig,
        visibilityCondition: q.visibilityCondition,
        visibilityConditions: q.visibilityConditions,
        visibilityConditionCombinator: q.visibilityConditionCombinator,
        optionConfigs: q.optionConfigs,
      }, { id: q.id })));
    }
  }, [currentSchema]);

  useEffect(() => {
    if (isReadOnly) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges || saveStatus === 'saving') {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges, saveStatus, isReadOnly]);

  const handlePublish = async () => {
    if (!id) return;
    setShowPublishModal(false);
    const ok = await publishSchema(id);
    if (ok) fetchSchema(id);
  };

  const handleClone = async () => {
    if (!id) return;
    const schema = await cloneSchema(id);
    if (schema) navigate(`/workbench/surveys/schemas/${schema.id}/edit`);
  };

  const handleReloadForConflict = useCallback(() => {
    if (id) {
      dismissConflict();
      fetchSchema(id);
    }
  }, [id, fetchSchema, dismissConflict]);

  if (currentSchemaLoading) {
    return <div className="p-6 text-center text-gray-500">{t('common.loading')}</div>;
  }

  if (!currentSchema) {
    return <div className="p-6 text-center text-gray-500">{t('survey.schema.notFound')}</div>;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {conflict && (
        <ConflictNotification
          onReload={handleReloadForConflict}
          onDismiss={dismissConflict}
        />
      )}

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/workbench/surveys/schemas')} className="text-gray-500 hover:text-gray-700">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">
            {isDraft ? t('survey.schema.editTitle') : t('survey.schema.viewTitle')}
          </h1>
          <SchemaStatusBadge status={currentSchema.status} />
        </div>
        <div className="flex items-center gap-3">
          {isDraft && (
            <SaveStatusIndicator
              status={saveStatus}
              lastSavedAt={lastSavedAt}
              onRetry={retrySave}
            />
          )}
          <SchemaExportButton schema={currentSchema} />
          <button
            onClick={() => setShowPreviewModal(true)}
            disabled={questions.length === 0}
            title={questions.length === 0 ? t('survey.preview.noQuestions', { defaultValue: 'Add at least one question to preview' }) : t('survey.preview.open', { defaultValue: 'Preview survey' })}
            className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-indigo-600 border border-indigo-300 rounded-md hover:bg-indigo-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Play className="w-4 h-4" /> {t('survey.preview.button', { defaultValue: 'Preview' })}
          </button>
          {isReadOnly && (
            <button onClick={handleClone} className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-indigo-600 border border-indigo-300 rounded-md hover:bg-indigo-50">
              <Copy className="w-4 h-4" /> {t('survey.schemas.clone')}
            </button>
          )}
          {isDraft && (
            <button
              onClick={() => setShowPublishModal(true)}
              disabled={questions.length === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('survey.schema.publish')}
            </button>
          )}
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('survey.schema.titleLabel')}</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isReadOnly}
              className="w-full px-3 py-2 border rounded-md focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-50"
              maxLength={200}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('survey.schema.descriptionLabel')}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isReadOnly}
              className="w-full px-3 py-2 border rounded-md focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-50"
              rows={3}
              maxLength={1000}
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">{t('survey.schema.questionsHeading')}</h2>
            {questions.some(q => q.visibilityCondition || (q.visibilityConditions && q.visibilityConditions.length > 0)) && (
              <button
                type="button"
                onClick={() => setShowPreview(!showPreview)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-indigo-600 border border-indigo-300 rounded-md hover:bg-indigo-50"
              >
                <Eye className="w-3.5 h-3.5" />
                {showPreview ? t('survey.preview.hide') : t('survey.preview.show')}
              </button>
            )}
          </div>
          <QuestionList questions={questions} onChange={setQuestions} disabled={isReadOnly} />
        </div>

        {showPreview && currentSchema && (
          <SchemaPreviewPanel
            builtQuestions={currentSchema.questions}
          />
        )}
      </div>

      <PublishConfirmModal
        open={showPublishModal}
        onConfirm={handlePublish}
        onCancel={() => setShowPublishModal(false)}
      />

      {showPreviewModal && currentSchema && (
        <SurveyPreviewModal
          questions={currentSchema.questions}
          title={currentSchema.title}
          onClose={() => setShowPreviewModal(false)}
        />
      )}
    </div>
  );
}
