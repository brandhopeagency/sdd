import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSurveyStore } from '@/stores/surveyStore';
import type { SurveySchemaListItem } from '@mentalhelpglobal/chat-types';
import { X } from 'lucide-react';

interface Props {
  onClose: () => void;
  onCreated: () => void;
  publishedSchemas: SurveySchemaListItem[];
  groups: { id: string; name: string }[];
}

export default function InstanceCreateForm({ onClose, onCreated, publishedSchemas, groups }: Props) {
  const { t } = useTranslation();
  const { createInstance } = useSurveyStore();
  const [schemaId, setSchemaId] = useState('');
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [publicHeader, setPublicHeader] = useState('');
  const [showReview, setShowReview] = useState(true);
  const [addToMemory, setAddToMemory] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schemaId || selectedGroups.length === 0 || !startDate || !expirationDate) {
      setError(t('survey.instance.requiredFields'));
      return;
    }
    if (new Date(expirationDate) <= new Date(startDate)) {
      setError(t('survey.instance.expiryAfterStart'));
      return;
    }
    setSubmitting(true);
    setError('');
    const result = await createInstance({
      schemaId,
      groupIds: selectedGroups,
      addToMemory,
      publicHeader: publicHeader.trim() || undefined,
      showReview,
      startDate: new Date(startDate).toISOString(),
      expirationDate: new Date(expirationDate).toISOString(),
    });
    setSubmitting(false);
    if (result) {
      onCreated();
    } else {
      setError(t('survey.instance.createFailed'));
    }
  };

  const toggleGroup = (gid: string) => {
    setSelectedGroups(prev =>
      prev.includes(gid) ? prev.filter(id => id !== gid) : [...prev, gid],
    );
  };

  return (
    <div className="bg-white border rounded-lg shadow-md p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">{t('survey.instance.createTitle')}</h3>
        <button onClick={onClose} aria-label={t('common.cancel')} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
      </div>

      {error && <div className="p-3 mb-4 text-sm text-red-700 bg-red-50 rounded" role="alert">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('survey.instance.schema')}</label>
          <select value={schemaId} onChange={e => setSchemaId(e.target.value)} className="w-full px-3 py-2 border rounded-md text-sm" required>
            <option value="">{t('survey.instance.selectSchema')}</option>
            {publishedSchemas.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('survey.instance.groups')}</label>
          <div className="max-h-32 overflow-y-auto border rounded-md p-2 space-y-1">
            {groups.map(g => (
              <label key={g.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={selectedGroups.includes(g.id)} onChange={() => toggleGroup(g.id)} className="rounded" />
                {g.name}
              </label>
            ))}
            {groups.length === 0 && <span className="text-sm text-gray-400">{t('survey.instance.noGroups')}</span>}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('survey.instance.publicHeader')}</label>
          <input
            type="text"
            value={publicHeader}
            onChange={e => setPublicHeader(e.target.value)}
            maxLength={300}
            placeholder={t('survey.instance.publicHeaderPlaceholder')}
            className="w-full px-3 py-2 border rounded-md text-sm"
          />
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showReview}
              onChange={e => setShowReview(e.target.checked)}
              className="rounded"
            />
            {t('survey.instance.showReview')}
          </label>
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={addToMemory}
              onChange={e => setAddToMemory(e.target.checked)}
              className="rounded"
            />
            {t('survey.instance.addToMemory')}
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('survey.instance.startDate')}</label>
            <input type="datetime-local" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-3 py-2 border rounded-md text-sm" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('survey.instance.expirationDate')}</label>
            <input
              type="datetime-local"
              value={expirationDate}
              onChange={e => setExpirationDate(e.target.value)}
              min={startDate}
              className="w-full px-3 py-2 border rounded-md text-sm"
              required
            />
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">
            {t('common.cancel')}
          </button>
          <button type="submit" disabled={submitting} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50">
            {submitting ? t('common.creating') : t('survey.instance.create')}
          </button>
        </div>
      </form>
    </div>
  );
}
