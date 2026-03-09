import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSurveyStore } from '@/stores/surveyStore';
import { adminGroupsApi } from '@/services/adminApi';
import { ArrowLeft, EyeOff } from 'lucide-react';

export default function SurveyResponseListView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const {
    responses,
    responsesLoading,
    fetchResponses,
    currentInstance,
    fetchInstance,
    invalidateInstance,
    invalidateGroup,
    invalidateResponse,
  } = useSurveyStore();

  const [groupNameById, setGroupNameById] = useState<Record<string, string>>({});
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [hideNonVisible, setHideNonVisible] = useState(false);

  useEffect(() => {
    if (id) {
      fetchInstance(id);
      fetchResponses(id);
    }
  }, [id, fetchInstance, fetchResponses]);

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

  const handleInvalidateInstance = async () => {
    if (!id) return;
    const reason = window.prompt(t('survey.invalidation.reasonPrompt')) ?? null;
    if (reason === null) return;
    const ok = await invalidateInstance(id, reason || undefined);
    if (ok) {
      await fetchInstance(id);
      await fetchResponses(id);
    }
  };

  const handleInvalidateGroup = async () => {
    if (!id || !selectedGroupId) return;
    const reason = window.prompt(t('survey.invalidation.reasonPrompt')) ?? null;
    if (reason === null) return;
    const ok = await invalidateGroup(id, selectedGroupId, reason || undefined);
    if (ok) {
      await fetchInstance(id);
      await fetchResponses(id);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(`/workbench/surveys/instances/${id}`)} className="text-gray-500 hover:text-gray-700">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">{t('survey.responses.title')}</h1>
        </div>

        {currentInstance && (
          <div className="flex flex-wrap items-center gap-2">
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
                  className="px-3 py-2 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-md hover:bg-amber-100"
                >
                  {t('survey.invalidation.invalidateGroup')}
                </button>
              </>
            )}
            <button
              onClick={handleInvalidateInstance}
              className="px-3 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100"
            >
              {t('survey.invalidation.invalidateAll')}
            </button>
          </div>
        )}
      </div>

      {responsesLoading ? (
        <div className="text-center py-12 text-gray-500">{t('common.loading')}</div>
      ) : responses.length === 0 ? (
        <div className="text-center py-12 text-gray-500">{t('survey.responses.empty')}</div>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-4">
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hideNonVisible}
                onChange={(e) => setHideNonVisible(e.target.checked)}
                className="rounded border-gray-300"
              />
              <EyeOff className="w-4 h-4" />
              {t('survey.responses.hideNonVisible')}
            </label>
          </div>
          <div className="space-y-4">
            {responses.map((resp) => (
              <div key={resp.id} className="bg-white rounded-lg shadow p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-mono text-gray-500">{resp.pseudonymousId.slice(0, 8)}...</span>
                  <div className="flex items-center gap-2">
                    {(resp as any).invalidatedAt ? (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        {t('survey.invalidation.invalidated')}
                      </span>
                    ) : (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${resp.isComplete ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                        {resp.isComplete ? t('survey.responses.complete') : t('survey.responses.partial')}
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={async () => {
                        const reason = window.prompt(t('survey.invalidation.reasonPrompt')) ?? null;
                        if (reason === null) return;
                        const ok = await invalidateResponse(resp.id, reason || undefined);
                        if (ok && id) await fetchResponses(id);
                      }}
                      className="px-2 py-1 text-xs font-medium text-red-700 border border-red-200 rounded hover:bg-red-50"
                    >
                      {t('survey.invalidation.invalidateOne')}
                    </button>
                  </div>
                </div>
                <div className="text-xs text-gray-400 mb-2">
                  {t('survey.responses.started')}: {new Date(resp.startedAt).toLocaleString()}
                  {resp.completedAt && <> · {t('survey.responses.completed')}: {new Date(resp.completedAt).toLocaleString()}</>}
                  {(resp as any).groupId && <> · {t('survey.invalidation.group')}: {groupNameById[(resp as any).groupId] || (resp as any).groupId}</>}
                  {(resp as any).invalidatedAt && <> · {t('survey.invalidation.invalidatedAt')}: {new Date((resp as any).invalidatedAt).toLocaleString()}</>}
                </div>
                <div className="space-y-1">
                  {resp.answers.map((ans, i) => {
                    const isVisible = (ans as any).visible !== false;
                    if (hideNonVisible && !isVisible) return null;
                    return (
                      <div key={i} className={`text-sm ${!isVisible ? 'opacity-50' : ''}`}>
                        <span className="text-gray-400 font-mono text-xs">Q{i + 1}:</span>{' '}
                        {isVisible ? (
                          <span className="text-gray-700">
                            {Array.isArray(ans.value) ? ans.value.join(', ') : typeof ans.value === 'boolean' ? (ans.value ? 'Yes' : 'No') : String(ans.value ?? '—')}
                          </span>
                        ) : (
                          <span className="text-gray-400 italic">{t('survey.responses.notShown')}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
