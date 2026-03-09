import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { groupSurveyApi } from '@/services/surveyApi';
import GroupSurveyList from './components/GroupSurveyList';

interface GroupSurveyOrderItem {
  instanceId: string;
  title: string;
  publicHeader: string | null;
  status: string;
  displayOrder: number;
  startDate: string;
  expirationDate: string;
  completedCount: number;
  showReview: boolean;
}

export default function GroupSurveysPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [surveys, setSurveys] = useState<GroupSurveyOrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSurveys = useCallback(async () => {
    if (!groupId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await groupSurveyApi.list(groupId);
      if (res.success && res.data) {
        setSurveys(res.data);
      } else {
        setError(res.error?.message ?? 'Failed to load surveys');
      }
    } catch {
      setError('Failed to load surveys');
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    loadSurveys();
  }, [loadSurveys]);

  const handleReorder = useCallback(
    async (instanceIds: string[]) => {
      if (!groupId) return;
      await groupSurveyApi.updateOrder(groupId, instanceIds);
      await loadSurveys();
    },
    [groupId, loadSurveys],
  );

  const handleDownload = useCallback(
    async (instanceId: string, format: 'json' | 'csv') => {
      if (!groupId) return;
      await groupSurveyApi.downloadResponses(instanceId, groupId, format);
    },
    [groupId],
  );

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/workbench/groups')}
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-bold">{t('survey.groupSurveys.title')}</h1>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 text-gray-500">
          {t('common.loading', 'Loading…')}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && surveys.length === 0 && (
        <div className="flex items-center justify-center py-16 text-gray-400">
          {t('survey.groupSurveys.empty')}
        </div>
      )}

      {!loading && !error && surveys.length > 0 && (
        <GroupSurveyList
          surveys={surveys}
          onReorder={handleReorder}
          onDownload={handleDownload}
        />
      )}
    </div>
  );
}
