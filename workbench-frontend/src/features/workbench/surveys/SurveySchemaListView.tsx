import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@mentalhelpglobal/chat-frontend-common';
import { Permission, SurveySchemaStatus } from '@mentalhelpglobal/chat-types';
import { useSurveyStore } from '@/stores/surveyStore';
import SchemaStatusBadge from './components/SchemaStatusBadge';
import SchemaImportDialog from './components/SchemaImportDialog';
import { Plus, Copy, Archive, RotateCcw, Trash2, Pencil, Upload } from 'lucide-react';

export default function SurveySchemaListView() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { schemas, schemasLoading, schemasError, fetchSchemas, cloneSchema, archiveSchema, restoreSchema, deleteSchema } = useSurveyStore();
  const [showArchived, setShowArchived] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);

  const isAdmin = user?.permissions.includes(Permission.SURVEY_SCHEMA_ARCHIVE);

  useEffect(() => {
    fetchSchemas(showArchived ? 'archived' : undefined);
  }, [showArchived, fetchSchemas]);

  const handleCreate = async () => {
    setActionError(null);
    const schema = await useSurveyStore.getState().createSchema(t('survey.schema.untitled'));
    if (schema) {
      navigate(`/workbench/surveys/schemas/${schema.id}/edit`);
    } else {
      setActionError(t('survey.schemas.createFailed'));
    }
  };

  const handleClone = async (id: string) => {
    const schema = await cloneSchema(id);
    if (schema) navigate(`/workbench/surveys/schemas/${schema.id}/edit`);
  };

  const handleArchive = async (id: string) => {
    if (await archiveSchema(id)) fetchSchemas(showArchived ? 'archived' : undefined);
  };

  const handleRestore = async (id: string) => {
    if (await restoreSchema(id)) fetchSchemas(showArchived ? 'archived' : undefined);
  };

  const handleDelete = async (id: string) => {
    if (await deleteSchema(id)) {
      setDeleteConfirmId(null);
      fetchSchemas(showArchived ? 'archived' : undefined);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('survey.schemas.title')}</h1>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="rounded"
            />
            {t('survey.schemas.showArchived')}
          </label>
          <button
            onClick={() => setShowImportDialog(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 border border-indigo-300 rounded-md hover:bg-indigo-50"
          >
            <Upload className="w-4 h-4" /> {t('survey.import.button', { defaultValue: 'Import' })}
          </button>
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
          >
            <Plus className="w-4 h-4" /> {t('survey.schemas.create')}
          </button>
        </div>
      </div>

      {(schemasError || actionError) && (
        <div className="p-4 mb-4 text-red-700 bg-red-50 rounded-lg">{schemasError || actionError}</div>
      )}

      {schemasLoading ? (
        <div className="text-center py-12 text-gray-500">{t('common.loading')}</div>
      ) : schemas.length === 0 ? (
        <div className="text-center py-12 text-gray-500">{t('survey.schemas.empty')}</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('survey.schemas.col.title')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('survey.schemas.col.status')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('survey.schemas.col.questions')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('survey.schemas.col.created')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('survey.schemas.col.published')}</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('survey.schemas.col.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {schemas.map((schema) => (
                <tr key={schema.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{schema.title}</td>
                  <td className="px-6 py-4"><SchemaStatusBadge status={schema.status} /></td>
                  <td className="px-6 py-4 text-sm text-gray-600">{schema.questionCount}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{new Date(schema.createdAt).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {schema.publishedAt ? new Date(schema.publishedAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => navigate(`/workbench/surveys/schemas/${schema.id}/edit`)} aria-label={schema.status === SurveySchemaStatus.DRAFT ? t('common.edit') : t('common.view')} className="text-gray-500 hover:text-indigo-600">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleClone(schema.id)} aria-label={t('survey.schemas.clone')} className="text-gray-500 hover:text-indigo-600">
                        <Copy className="w-4 h-4" />
                      </button>
                      {isAdmin && schema.status === SurveySchemaStatus.PUBLISHED && (
                        <button onClick={() => handleArchive(schema.id)} aria-label={t('survey.schemas.archive')} className="text-gray-500 hover:text-yellow-600">
                          <Archive className="w-4 h-4" />
                        </button>
                      )}
                      {isAdmin && schema.status === SurveySchemaStatus.ARCHIVED && (
                        <button onClick={() => handleRestore(schema.id)} aria-label={t('survey.schemas.restore')} className="text-gray-500 hover:text-green-600">
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      )}
                      {schema.status === SurveySchemaStatus.DRAFT && (
                        <>
                          {deleteConfirmId === schema.id ? (
                            <div className="flex items-center gap-1">
                              <button onClick={() => handleDelete(schema.id)} className="text-xs text-red-600 font-medium">{t('common.confirm')}</button>
                              <button onClick={() => setDeleteConfirmId(null)} className="text-xs text-gray-500">{t('common.cancel')}</button>
                            </div>
                          ) : (
                            <button onClick={() => setDeleteConfirmId(schema.id)} title={t('common.delete')} className="text-gray-500 hover:text-red-600">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <SchemaImportDialog
        open={showImportDialog}
        onClose={() => {
          setShowImportDialog(false);
          fetchSchemas(showArchived ? 'archived' : undefined);
        }}
      />
    </div>
  );
}
