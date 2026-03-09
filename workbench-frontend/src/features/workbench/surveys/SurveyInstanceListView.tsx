import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@mentalhelpglobal/chat-frontend-common';
import { Permission } from '@mentalhelpglobal/chat-types';
import { useSurveyStore } from '@/stores/surveyStore';
import { adminGroupsApi } from '@/services/adminApi';
import InstanceStatusBadge from './components/InstanceStatusBadge';
import InstanceCreateForm from './components/InstanceCreateForm';
import { Plus } from 'lucide-react';

export default function SurveyInstanceListView() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { instances, instancesLoading, instancesError, fetchInstances, schemas, fetchSchemas } = useSurveyStore();
  const [showCreate, setShowCreate] = useState(false);
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);

  const canManage = user?.permissions.includes(Permission.SURVEY_INSTANCE_MANAGE);

  useEffect(() => {
    fetchInstances();
    fetchSchemas('published');
    adminGroupsApi.list().then(res => {
      if (res.success && res.data) {
        setGroups(res.data.map(g => ({ id: g.id, name: g.name })));
      }
    });
  }, [fetchInstances, fetchSchemas]);

  const publishedSchemas = schemas;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('survey.instances.title')}</h1>
        {canManage && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
          >
            <Plus className="w-4 h-4" /> {t('survey.instances.create')}
          </button>
        )}
      </div>

      {showCreate && (
        <InstanceCreateForm
          publishedSchemas={publishedSchemas}
          groups={groups}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); fetchInstances(); }}
        />
      )}

      {instancesError && <div className="p-4 mb-4 text-red-700 bg-red-50 rounded-lg" role="alert">{instancesError}</div>}

      {instancesLoading ? (
        <div className="text-center py-12 text-gray-500">{t('common.loading')}</div>
      ) : instances.length === 0 ? (
        <div className="text-center py-12 text-gray-500">{t('survey.instances.empty')}</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('survey.instances.col.title')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('survey.instances.col.status')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('survey.instances.col.groups')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('survey.instances.col.start')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('survey.instances.col.expiry')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('survey.instances.col.completed')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {instances.map((inst) => (
                <tr key={inst.id} className="hover:bg-gray-50 cursor-pointer" tabIndex={0} role="link" onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/workbench/surveys/instances/${inst.id}`); }} onClick={() => navigate(`/workbench/surveys/instances/${inst.id}`)}>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{inst.title}</td>
                  <td className="px-6 py-4"><InstanceStatusBadge status={inst.status} /></td>
                  <td className="px-6 py-4 text-sm text-gray-500">{inst.groupIds.length}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{new Date(inst.startDate).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{new Date(inst.expirationDate).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{inst.completedCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
