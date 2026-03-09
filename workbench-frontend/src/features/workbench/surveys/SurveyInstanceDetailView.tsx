import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@mentalhelpglobal/chat-frontend-common';
import { Permission, SurveyInstanceStatus } from '@mentalhelpglobal/chat-types';
import type { SurveyQuestion } from '@mentalhelpglobal/chat-types';
import { useSurveyStore } from '@/stores/surveyStore';
import { adminGroupsApi } from '@/services/adminApi';
import InstanceStatusBadge from './components/InstanceStatusBadge';
import { ArrowLeft, XCircle, FileText } from 'lucide-react';

export default function SurveyInstanceDetailView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const {
    currentInstance,
    currentInstanceLoading,
    fetchInstance,
    closeInstance,
    invalidateInstance,
    invalidateGroup,
  } = useSurveyStore();

  const [groupNameById, setGroupNameById] = useState<Record<string, string>>({});
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');

  const canManage = user?.permissions.includes(Permission.SURVEY_INSTANCE_MANAGE);
  const canViewResponses = user?.permissions.includes(Permission.SURVEY_RESPONSE_VIEW);

  useEffect(() => {
    if (id) fetchInstance(id);
  }, [id, fetchInstance]);

  useEffect(() => {
    const groupIds = currentInstance?.groupIds ?? [];
    if (!groupIds.length) return;
    if (!selectedGroupId) setSelectedGroupId(groupIds[0]);

    void (async () => {
      const res = await adminGroupsApi.list();
      if (!res.success || !res.data) return;
      const map: Record<string, string> = {};
      for (const g of res.data) map[g.id] = g.name;
      setGroupNameById(map);
    })();
  }, [currentInstance?.groupIds, selectedGroupId]);

  const groupOptions = useMemo(() => {
    const groupIds = currentInstance?.groupIds ?? [];
    return groupIds.map((gid) => ({ id: gid, name: groupNameById[gid] || gid }));
  }, [currentInstance?.groupIds, groupNameById]);

  const handleClose = async () => {
    if (id && await closeInstance(id)) fetchInstance(id);
  };

  const handleInvalidateInstance = async () => {
    if (!id) return;
    const reason = window.prompt(t('survey.invalidation.reasonPrompt')) ?? null;
    if (reason === null) return;
    const ok = await invalidateInstance(id, reason || undefined);
    if (ok) fetchInstance(id);
  };

  const handleInvalidateGroup = async () => {
    if (!id || !selectedGroupId) return;
    const reason = window.prompt(t('survey.invalidation.reasonPrompt')) ?? null;
    if (reason === null) return;
    const ok = await invalidateGroup(id, selectedGroupId, reason || undefined);
    if (ok) fetchInstance(id);
  };

  if (currentInstanceLoading) return <div className="p-6 text-center text-gray-500">{t('common.loading')}</div>;
  if (!currentInstance) return <div className="p-6 text-center text-gray-500">{t('survey.instance.notFound')}</div>;

  const snapshot = currentInstance.schemaSnapshot;
  const questions = snapshot?.questions ?? [];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/workbench/surveys/instances')} className="text-gray-500 hover:text-gray-700">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">{currentInstance.title}</h1>
          <InstanceStatusBadge status={currentInstance.status} />
        </div>
        <div className="flex items-center gap-2">
          {canViewResponses && (
            <button
              onClick={() => navigate(`/workbench/surveys/instances/${id}/responses`)}
              className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-indigo-600 border border-indigo-300 rounded-md hover:bg-indigo-50"
            >
              <FileText className="w-4 h-4" /> {t('survey.instance.viewResponses')}
            </button>
          )}
          {canManage && (
            <div className="flex items-center gap-2">
              {groupOptions.length > 0 && (
                <>
                  <select
                    value={selectedGroupId}
                    onChange={(e) => setSelectedGroupId(e.target.value)}
                    className="px-3 py-2 border rounded-md text-sm bg-white"
                    aria-label={t('survey.invalidation.selectGroup')}
                  >
                    {groupOptions.map((g) => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleInvalidateGroup}
                    className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-amber-700 border border-amber-200 rounded-md hover:bg-amber-50"
                  >
                    {t('survey.invalidation.invalidateGroup')}
                  </button>
                </>
              )}
              <button
                onClick={handleInvalidateInstance}
                className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-red-700 border border-red-200 rounded-md hover:bg-red-50"
              >
                {t('survey.invalidation.invalidateAll')}
              </button>
            </div>
          )}
          {canManage && currentInstance.status === SurveyInstanceStatus.ACTIVE && (
            <button
              onClick={handleClose}
              className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-red-600 border border-red-300 rounded-md hover:bg-red-50"
            >
              <XCircle className="w-4 h-4" /> {t('survey.instance.close')}
            </button>
          )}
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">{t('survey.instance.details')}</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            {currentInstance.publicHeader && (
              <div>
                <dt className="text-gray-500">{t('survey.instance.publicHeader')}</dt>
                <dd className="font-medium">{currentInstance.publicHeader}</dd>
              </div>
            )}
            <div>
              <dt className="text-gray-500">{t('survey.instance.showReview')}</dt>
              <dd className="font-medium">{currentInstance.showReview !== false ? t('common.yes') : t('common.no')}</dd>
            </div>
            <div>
              <dt className="text-gray-500">{t('survey.instance.addToMemory')}</dt>
              <dd className="font-medium">{currentInstance.addToMemory ? t('common.yes') : t('common.no')}</dd>
            </div>
            <div>
              <dt className="text-gray-500">{t('survey.instances.col.groups')}</dt>
              <dd className="font-medium">{currentInstance.groupIds.length} {t('survey.instance.groupCount')}</dd>
            </div>
            <div>
              <dt className="text-gray-500">{t('survey.instance.startDate')}</dt>
              <dd className="font-medium">{new Date(currentInstance.startDate).toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-gray-500">{t('survey.instance.expirationDate')}</dt>
              <dd className="font-medium">{new Date(currentInstance.expirationDate).toLocaleString()}</dd>
            </div>
            {currentInstance.completedCount !== undefined && (
              <div>
                <dt className="text-gray-500">{t('survey.instances.col.completed')}</dt>
                <dd className="font-medium">{currentInstance.completedCount}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">{t('survey.instance.snapshot')}</h2>
          <div className="space-y-3">
            {questions.map((q: SurveyQuestion, i: number) => (
              <div key={q.id} className="border rounded-md p-3">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-400 font-mono">#{i + 1}</span>
                  <span className="px-1.5 py-0.5 text-xs bg-gray-100 rounded">{q.type}</span>
                  {q.required && <span className="text-xs text-red-500">*</span>}
                </div>
                <p className="mt-1 text-sm text-gray-800">{q.text}</p>
                {q.options && (
                  <ul className="mt-1 ml-4 text-xs text-gray-500 list-disc">
                    {q.options.map((opt: string, j: number) => <li key={j}>{opt}</li>)}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
