import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Trash2, Check, X, Loader2, Tag, Search } from 'lucide-react';
import { TagBadge } from './components/TagBadge';
import {
  listTagDefinitions,
  createTagDefinition,
  updateTagDefinition,
  deleteTagDefinition,
} from '@/services/tagApi';
import { useAuthStore, hasPermission } from '@mentalhelpglobal/chat-frontend-common';
import { Permission } from '@mentalhelpglobal/chat-types';
import type { TagDefinition, CreateTagDefinitionInput } from '@mentalhelpglobal/chat-types';

interface EditingState {
  id: string;
  name: string;
  description: string;
  excludeFromReviews: boolean;
  isActive: boolean;
}

export default function TagManagementPage() {
  const { t } = useTranslation();
  const { user } = useAuthStore();

  const canManage = Boolean(
    user?.permissions && hasPermission(user.permissions, Permission.TAG_MANAGE),
  );
  const canCreateTag = Boolean(
    user?.permissions && hasPermission(user.permissions, Permission.TAG_CREATE),
  );

  const [tags, setTags] = useState<TagDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Create form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState<CreateTagDefinitionInput>({
    name: '',
    description: '',
    category: 'user',
    excludeFromReviews: false,
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Inline edit state
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [saving, setSaving] = useState(false);

  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    tag: TagDefinition;
    affectedUsers?: number;
    affectedSessions?: number;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Auto-clear success message
  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  const fetchTags = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await listTagDefinitions();
      setTags(data);
    } catch (err: any) {
      setError(err.message || t('review.common.error'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  const filteredTags = useMemo(() => {
    if (!searchQuery.trim()) return tags;
    const q = searchQuery.toLowerCase();
    return tags.filter(
      (tag) =>
        tag.name.toLowerCase().includes(q) ||
        (tag.description && tag.description.toLowerCase().includes(q))
    );
  }, [tags, searchQuery]);

  // ── Create ──

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name.trim()) return;

    try {
      setCreating(true);
      setCreateError(null);
      await createTagDefinition({
        name: createForm.name.trim(),
        description: createForm.description || undefined,
        category: createForm.category,
        excludeFromReviews: createForm.excludeFromReviews,
      });
      setCreateForm({ name: '', description: '', category: 'user', excludeFromReviews: false });
      setShowCreateForm(false);
      setSuccessMsg(t('review.config.saved'));
      await fetchTags();
    } catch (err: any) {
      if (err.message?.includes('already exists')) {
        setCreateError(t('review.tags.duplicateError'));
      } else {
        setCreateError(err.message || t('review.common.error'));
      }
    } finally {
      setCreating(false);
    }
  };

  // ── Inline edit ──

  const startEdit = (tag: TagDefinition) => {
    setEditing({
      id: tag.id,
      name: tag.name,
      description: tag.description || '',
      excludeFromReviews: tag.excludeFromReviews,
      isActive: tag.isActive,
    });
  };

  const cancelEdit = () => {
    setEditing(null);
  };

  const saveEdit = async () => {
    if (!editing) return;

    try {
      setSaving(true);
      setError(null);
      await updateTagDefinition(editing.id, {
        name: editing.name.trim(),
        description: editing.description || undefined,
        excludeFromReviews: editing.excludeFromReviews,
        isActive: editing.isActive,
      });
      setEditing(null);
      setSuccessMsg(t('review.config.saved'));
      await fetchTags();
    } catch (err: any) {
      if (err.message?.includes('already exists')) {
        setError(t('review.tags.duplicateError'));
      } else {
        setError(err.message || t('review.common.error'));
      }
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ──

  const confirmDelete = (tag: TagDefinition) => {
    setDeleteConfirm({ tag });
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;

    try {
      setDeleting(true);
      setError(null);
      await deleteTagDefinition(deleteConfirm.tag.id);
      setDeleteConfirm(null);
      setSuccessMsg(t('review.config.saved'));
      await fetchTags();
    } catch (err: any) {
      setError(err.message || t('review.common.error'));
    } finally {
      setDeleting(false);
    }
  };

  if (!canManage) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-neutral-500">{t('review.common.error')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Tag className="h-6 w-6 text-neutral-600" />
          <h1 className="text-2xl font-bold text-neutral-800">
            {t('review.tags.tagManagement')}
          </h1>
        </div>
        {canCreateTag && (
          <button
            type="button"
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            <Plus size={16} />
            {t('review.tags.createNew')}
          </button>
        )}
      </div>

      {/* Success message */}
      {successMsg && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {successMsg}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
          <button
            type="button"
            onClick={() => setError(null)}
            className="ml-2 text-red-600 underline hover:no-underline"
          >
            {t('review.common.close')}
          </button>
        </div>
      )}

      {/* Create form */}
      {showCreateForm && (
        <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-neutral-700">
            {t('review.tags.createNew')}
          </h2>
          {createError && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {createError}
            </div>
          )}
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-semibold text-neutral-700">
                  {t('review.tags.tagName')} *
                </label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder={t('review.tags.tagName')}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-neutral-700">
                  {t('review.tags.category')} *
                </label>
                <select
                  value={createForm.category}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      category: e.target.value as 'user' | 'chat',
                    })
                  }
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="user">{t('review.tags.categoryUser')}</option>
                  <option value="chat">{t('review.tags.categoryChat')}</option>
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-neutral-700">
                {t('review.tags.tagDescription')}
              </label>
              <textarea
                value={createForm.description || ''}
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                rows={2}
                placeholder={t('review.tags.tagDescription')}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="create-exclude"
                checked={createForm.excludeFromReviews}
                onChange={(e) =>
                  setCreateForm({ ...createForm, excludeFromReviews: e.target.checked })
                }
                className="h-4 w-4 rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="create-exclude" className="text-sm text-neutral-700">
                {t('review.tags.excludeFromReviews')}
              </label>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={creating || !createForm.name.trim()}
                className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {creating && <Loader2 size={14} className="animate-spin" />}
                {t('review.common.save')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  setCreateError(null);
                }}
                className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
              >
                {t('review.common.cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search filter */}
      {!loading && tags.length > 0 && (
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            className="input pl-10"
            placeholder={t('review.tags.searchPlaceholder', 'Filter tags by name or description...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      )}

      {/* Tags table */}
      <div className="rounded-lg border border-neutral-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 size={24} className="animate-spin text-neutral-400" />
            <span className="ml-2 text-sm text-neutral-500">{t('review.common.loading')}</span>
          </div>
        ) : tags.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-neutral-400">
            <Tag size={32} className="mb-2" />
            <p className="text-sm">{t('review.tags.noTags')}</p>
          </div>
        ) : filteredTags.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-neutral-400">
            <Search size={32} className="mb-2" />
            <p className="text-sm">{t('review.tags.noResults', 'No tags match your search')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50">
                  <th className="px-4 py-3 text-left font-semibold text-neutral-600">
                    {t('review.tags.tagName')}
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-neutral-600">
                    {t('review.tags.category')}
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-neutral-600">
                    {t('review.tags.tagDescription')}
                  </th>
                  <th className="px-4 py-3 text-center font-semibold text-neutral-600">
                    {t('review.tags.excludeFromReviews')}
                  </th>
                  <th className="px-4 py-3 text-center font-semibold text-neutral-600">
                    {t('review.tags.active')}
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-neutral-600">
                    {/* Actions */}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredTags.map((tag) => {
                  const isEditing = editing?.id === tag.id;

                  return (
                    <tr
                      key={tag.id}
                      className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50/50"
                    >
                      {isEditing ? (
                        <>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              value={editing.name}
                              onChange={(e) =>
                                setEditing({ ...editing, name: e.target.value })
                              }
                              className="w-full rounded border border-neutral-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <TagBadge name={tag.category} category={tag.category} />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              value={editing.description}
                              onChange={(e) =>
                                setEditing({ ...editing, description: e.target.value })
                              }
                              className="w-full rounded border border-neutral-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={editing.excludeFromReviews}
                              onChange={(e) =>
                                setEditing({ ...editing, excludeFromReviews: e.target.checked })
                              }
                              className="h-4 w-4 rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={editing.isActive}
                              onChange={(e) =>
                                setEditing({ ...editing, isActive: e.target.checked })
                              }
                              className="h-4 w-4 rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={saveEdit}
                                disabled={saving || !editing.name.trim()}
                                className="rounded p-1.5 text-emerald-600 transition-colors hover:bg-emerald-50 disabled:opacity-50"
                                aria-label={t('review.common.save')}
                              >
                                {saving ? (
                                  <Loader2 size={16} className="animate-spin" />
                                ) : (
                                  <Check size={16} />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={cancelEdit}
                                className="rounded p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100"
                                aria-label={t('review.common.cancel')}
                              >
                                <X size={16} />
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-3 font-medium text-neutral-800">
                            {tag.name}
                          </td>
                          <td className="px-4 py-3">
                            <TagBadge name={tag.category === 'user' ? t('review.tags.categoryUser') : t('review.tags.categoryChat')} category={tag.category} />
                          </td>
                          <td className="px-4 py-3 text-neutral-600">
                            {tag.description || '—'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {tag.excludeFromReviews ? (
                              <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                                {t('review.tags.excludeFromReviews')}
                              </span>
                            ) : (
                              <span className="text-neutral-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {tag.isActive ? (
                              <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                                {t('review.tags.active')}
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-500">
                                {t('review.tags.inactive')}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => startEdit(tag)}
                                className="rounded p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-blue-600"
                                aria-label={t('review.tags.editTag', { name: tag.name })}
                              >
                                <Pencil size={16} />
                              </button>
                              <button
                                type="button"
                                onClick={() => confirmDelete(tag)}
                                className="rounded p-1.5 text-neutral-500 transition-colors hover:bg-red-50 hover:text-red-600"
                                aria-label={t('review.tags.deleteTag', { name: tag.name })}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-2 text-lg font-semibold text-neutral-800">
              {t('review.tags.confirmDelete')}
            </h3>
            <p className="mb-4 text-sm text-neutral-600">
              {t('review.tags.confirmDeleteDescription', {
                userCount: deleteConfirm.affectedUsers ?? '?',
                sessionCount: deleteConfirm.affectedSessions ?? '?',
              })}
            </p>
            <p className="mb-4 text-sm font-medium text-neutral-700">
              {t('review.tags.tagLabel')}: <TagBadge name={deleteConfirm.tag.name} category={deleteConfirm.tag.category} />
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
                className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
              >
                {t('review.common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {deleting && <Loader2 size={14} className="animate-spin" />}
                {t('review.common.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
