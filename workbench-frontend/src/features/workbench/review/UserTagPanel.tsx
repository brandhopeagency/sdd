import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Loader2 } from 'lucide-react';
import { TagBadge } from './components/TagBadge';
import {
  listUserTags,
  assignUserTag,
  removeUserTag,
  listTagDefinitions,
} from '@/services/tagApi';
import { useAuthStore, hasPermission } from '@mentalhelpglobal/chat-frontend-common';
import { Permission } from '@mentalhelpglobal/chat-types';
import type { TagDefinition, UserTag } from '@mentalhelpglobal/chat-types';

interface UserTagPanelProps {
  userId: string;
}

export default function UserTagPanel({ userId }: UserTagPanelProps) {
  const { t } = useTranslation();
  const { user } = useAuthStore();

  const canAssignUser = Boolean(
    user?.permissions && hasPermission(user.permissions, Permission.TAG_ASSIGN_USER),
  );

  const [tags, setTags] = useState<UserTag[]>([]);
  const [availableTags, setAvailableTags] = useState<TagDefinition[]>([]);
  const [selectedTagId, setSelectedTagId] = useState('');
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTags = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [userTags, tagDefs] = await Promise.all([
        listUserTags(userId),
        listTagDefinitions({ category: 'user', active: true }),
      ]);
      setTags(userTags);
      setAvailableTags(tagDefs);
    } catch (err: any) {
      setError(err.message || t('review.common.error'));
    } finally {
      setLoading(false);
    }
  }, [userId, t]);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  // Tags already assigned (by definition ID)
  const assignedTagIds = new Set(tags.map((ut) => ut.tagDefinitionId));

  // Filter available tags to those not yet assigned
  const unassignedTags = availableTags.filter((td) => !assignedTagIds.has(td.id));

  const handleAssign = async () => {
    if (!selectedTagId) return;
    try {
      setAssigning(true);
      setError(null);
      await assignUserTag(userId, selectedTagId);
      setSelectedTagId('');
      await fetchTags();
    } catch (err: any) {
      setError(err.message || t('review.common.error'));
    } finally {
      setAssigning(false);
    }
  };

  const handleRemove = async (tagDefinitionId: string) => {
    try {
      setError(null);
      await removeUserTag(userId, tagDefinitionId);
      await fetchTags();
    } catch (err: any) {
      setError(err.message || t('review.common.error'));
    }
  };

  // If user lacks permission, don't render
  if (!canAssignUser) return null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-gray-700">
        {t('review.tags.title')}
      </h3>

      {error && (
        <p className="mb-2 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 size={14} className="animate-spin" />
          {t('review.common.loading')}
        </div>
      ) : (
        <>
          {/* Current tags */}
          <div className="mb-3 flex flex-wrap gap-1.5">
            {tags.length === 0 ? (
              <span className="text-xs text-gray-400">{t('review.tags.noTags')}</span>
            ) : (
              tags.map((ut) => (
                <TagBadge
                  key={ut.tagDefinitionId}
                  name={ut.tagDefinition?.name ?? ''}
                  category="user"
                  onRemove={() => handleRemove(ut.tagDefinitionId)}
                />
              ))
            )}
          </div>

          {/* Add tag controls */}
          {unassignedTags.length > 0 && (
            <div className="flex items-center gap-2">
              <select
                value={selectedTagId}
                onChange={(e) => setSelectedTagId(e.target.value)}
                className="flex-1 rounded border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                aria-label={t('review.tags.assignTag')}
              >
                <option value="">{t('review.tags.assignTag')}...</option>
                {unassignedTags.map((td) => (
                  <option key={td.id} value={td.id}>
                    {td.name}
                    {td.excludeFromReviews ? ` (${t('review.tags.excludeFromReviews')})` : ''}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleAssign}
                disabled={!selectedTagId || assigning}
                className="inline-flex items-center gap-1 rounded bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={t('review.tags.addTag')}
              >
                {assigning ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Plus size={12} />
                )}
                {t('review.tags.addTag')}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
