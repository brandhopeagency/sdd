import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useWorkbenchStore } from '../../../stores/workbenchStore';
import { useAuthStore } from '../../../stores/authStore';
import { Permission } from '../../../types';
import { maskName } from '../../../utils/piiMasking';
import { 
  ArrowLeft, 
  Plus, X, Save, CheckCircle, Tag as TagIcon
} from 'lucide-react';
import MessageBubble from '../../chat/MessageBubble';
import { TechnicalDetails } from '../../../components/TechnicalDetails';

export default function ModerationView() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { 
    selectedSession, 
    sessionMessages, 
    tags,
    annotations,
    selectSession,
    fetchTags,
    updateSessionStatus,
    addTagToSession,
    removeTagFromSession,
    saveAnnotation,
    piiMasked
  } = useWorkbenchStore();

  const canModerate = user?.permissions.includes(Permission.WORKBENCH_MODERATION) ?? false;

  const [qualityRating, setQualityRating] = useState<number>(3);
  const [notes, setNotes] = useState('');
  const [goldenReference, setGoldenReference] = useState('');
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [newTag, setNewTag] = useState('');

  const selectedMessage = selectedMessageId
    ? sessionMessages.find((m) => m.id === selectedMessageId) || null
    : null;

  useEffect(() => {
    if (sessionId) {
      selectSession(sessionId);
      fetchTags();
    }
    return () => selectSession(null);
  }, [sessionId, selectSession, fetchTags]);

  const handleSaveAnnotation = () => {
    if (!selectedSession || !canModerate) return;
    saveAnnotation({
      sessionId: selectedSession.id,
      messageId: selectedMessageId,
      qualityRating: qualityRating as 1 | 2 | 3 | 4 | 5,
      goldenReference: goldenReference || null,
      notes,
      tags: []
    });
    setNotes('');
    setGoldenReference('');
    setSelectedMessageId(null);
  };

  const handleMarkComplete = () => {
    if (!selectedSession || !canModerate) return;
    updateSessionStatus(selectedSession.id, 'moderated');
  };

  const handleAddTag = (tagName: string) => {
    if (!selectedSession || !canModerate || selectedSession.tags.includes(tagName)) return;
    addTagToSession(selectedSession.id, tagName);
    setShowTagPicker(false);
    setNewTag('');
  };

  if (!selectedSession) {
    return (
      <div className="text-center py-12">
        <p className="text-neutral-500">{t('common.notFound')}</p>
        <button onClick={() => navigate('/workbench/research')} className="btn-primary mt-4">
          {t('moderation.backToSessions')}
        </button>
      </div>
    );
  }

  const sessionTags = tags.filter(tag => tag.category === 'session');
  const messageTags = tags.filter(tag => tag.category === 'message');

  const ratingOptions = [
    { value: 1, label: t('moderation.annotation.ratings.poor') },
    { value: 2, label: t('moderation.annotation.ratings.fair') },
    { value: 3, label: t('moderation.annotation.ratings.good') },
    { value: 4, label: t('moderation.annotation.ratings.veryGood') },
    { value: 5, label: t('moderation.annotation.ratings.excellent') },
  ];

  return (
    <div className="h-full flex flex-col -m-6">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/workbench/research')}
              className="btn-ghost"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t('moderation.backToSessions')}
            </button>
            <div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm font-semibold text-neutral-700">
                  {selectedSession.id}
                </span>
                <span className={`badge ${
                  selectedSession.moderationStatus === 'moderated' ? 'badge-success' :
                  selectedSession.moderationStatus === 'in_review' ? 'badge-warning' :
                  'bg-neutral-100 text-neutral-600'
                }`}>
                  {selectedSession.moderationStatus}
                </span>
              </div>
              <p className="text-sm text-neutral-500 mt-0.5">
                {t('research.session.user')}: {piiMasked && selectedSession.userName 
                  ? maskName(selectedSession.userName) 
                  : selectedSession.userName || t('research.session.anonymous')
                } • {new Date(selectedSession.startedAt).toLocaleDateString()}
              </p>
            </div>
          </div>

          {/* Session tags */}
          <div className="flex items-center gap-2">
            {selectedSession.tags.map(tag => (
              <span 
                key={tag} 
                className="badge-info flex items-center gap-1"
              >
                {tag}
                {canModerate ? (
                  <button
                    onClick={() => removeTagFromSession(selectedSession.id, tag)}
                    className="hover:text-primary-800"
                  >
                    <X className="w-3 h-3" />
                  </button>
                ) : null}
              </span>
            ))}
            <div className="relative">
              <button
                onClick={() => (canModerate ? setShowTagPicker(!showTagPicker) : undefined)}
                className="btn-ghost text-sm"
                disabled={!canModerate}
              >
                <Plus className="w-4 h-4 mr-1" />
                {t('moderation.tags.addTag')}
              </button>
              
              {showTagPicker && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setShowTagPicker(false)} 
                  />
                  <div className="absolute right-0 top-full mt-2 bg-white rounded-lg shadow-lg border border-neutral-200 p-3 z-20 w-64">
                    <p className="text-xs text-neutral-500 mb-2">{t('moderation.tags.sessionTags')}</p>
                    <div className="flex flex-wrap gap-1 mb-3">
                      {sessionTags.map(tag => (
                        <button
                          key={tag.id}
                          onClick={() => handleAddTag(tag.name)}
                          disabled={selectedSession.tags.includes(tag.name)}
                          className={`badge text-xs cursor-pointer ${
                            selectedSession.tags.includes(tag.name)
                              ? 'opacity-50 cursor-not-allowed'
                              : 'hover:opacity-80'
                          }`}
                          style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                        >
                          {tag.name}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        placeholder={t('moderation.tags.customTag')}
                        className="input text-sm flex-1"
                      />
                      <button
                        onClick={() => handleAddTag(newTag)}
                        disabled={!newTag.trim()}
                        className="btn-primary text-sm px-3"
                      >
                        {t('common.save')}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Three-column layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Column 1: Transcript */}
        <div className="w-1/3 border-r border-neutral-200 flex flex-col bg-white">
          <div className="px-4 py-3 border-b border-neutral-100 bg-neutral-50">
            <h3 className="font-semibold text-neutral-700">{t('moderation.columns.transcript')}</h3>
            <p className="text-xs text-neutral-500">{sessionMessages.length} {t('moderation.transcript.messages')}</p>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {sessionMessages.map((message) => (
              <div 
                key={message.id}
                onClick={(e) => {
                  const target = e.target as HTMLElement | null;
                  // Don't toggle selection when interacting with buttons inside the bubble (e.g. tech details toggle)
                  if (target?.closest('button')) return;
                  setSelectedMessageId(selectedMessageId === message.id ? null : message.id);
                }}
                className={`rounded-lg cursor-pointer transition-colors p-2 ${
                  selectedMessageId === message.id
                    ? 'bg-primary-50 ring-2 ring-primary-200'
                    : 'hover:bg-neutral-50'
                }`}
              >
                <MessageBubble message={message} />
              </div>
            ))}
          </div>
        </div>

        {/* Column 2: Golden Reference */}
        <div className="w-1/3 border-r border-neutral-200 flex flex-col bg-white">
          <div className="px-4 py-3 border-b border-neutral-100 bg-neutral-50">
            <h3 className="font-semibold text-neutral-700">{t('moderation.golden.title')}</h3>
            <p className="text-xs text-neutral-500">{t('moderation.golden.subtitle')}</p>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {selectedMessageId ? (
              <div>
                <p className="text-xs text-neutral-500 mb-2">
                  {t('moderation.golden.title')} - {selectedMessageId.slice(-6)}
                </p>
                <textarea
                  value={goldenReference}
                  onChange={(e) => setGoldenReference(e.target.value)}
                  placeholder={t('moderation.golden.placeholder')}
                  className="input resize-none h-48"
                />
                <p className="text-xs text-neutral-400 mt-2">
                  {t('moderation.golden.rlhfNote')}
                </p>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-center">
                <div>
                  <TagIcon className="w-12 h-12 text-neutral-200 mx-auto mb-3" />
                  <p className="text-neutral-500 text-sm">
                    {t('moderation.golden.selectMessage')}
                  </p>
                </div>
              </div>
            )}
            
            {annotations.length > 0 && (
              <div className="mt-6 pt-6 border-t border-neutral-100">
                <h4 className="text-sm font-medium text-neutral-700 mb-3">
                  {t('moderation.golden.previous')}
                </h4>
                <div className="space-y-3">
                  {annotations.map(ann => (
                    <div key={ann.id} className="p-3 bg-neutral-50 rounded-lg text-sm">
                      {ann.goldenReference && (
                        <p className="text-neutral-600 mb-2 italic">
                          "{ann.goldenReference}"
                        </p>
                      )}
                      <p className="text-neutral-500 text-xs">
                        {t('moderation.golden.rating')}: {ann.qualityRating}/5 • {new Date(ann.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Column 3: Annotation */}
        <div className="w-1/3 flex flex-col bg-white">
          <div className="px-4 py-3 border-b border-neutral-100 bg-neutral-50">
            <h3 className="font-semibold text-neutral-700">{t('moderation.annotation.title')}</h3>
            <p className="text-xs text-neutral-500">{t('moderation.annotation.subtitle')}</p>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {/* Quality Rating */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-neutral-700 mb-3">
                {t('moderation.annotation.qualityRating')}
              </label>
              <div className="space-y-2">
                {ratingOptions.map(option => (
                  <label 
                    key={option.value}
                    className={`flex items-center p-3 rounded-lg cursor-pointer transition-colors ${
                      qualityRating === option.value
                        ? 'bg-primary-50 ring-2 ring-primary-200'
                        : 'bg-neutral-50 hover:bg-neutral-100'
                    }`}
                  >
                    <input
                      type="radio"
                      name="rating"
                      value={option.value}
                      checked={qualityRating === option.value}
                      onChange={() => setQualityRating(option.value)}
                      className="sr-only"
                    />
                    <span className={`w-5 h-5 rounded-full border-2 mr-3 flex items-center justify-center ${
                      qualityRating === option.value
                        ? 'border-primary-500 bg-primary-500'
                        : 'border-neutral-300'
                    }`}>
                      {qualityRating === option.value && (
                        <span className="w-2 h-2 rounded-full bg-white" />
                      )}
                    </span>
                    <span className="text-sm text-neutral-700">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                {t('moderation.annotation.notes')}
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('moderation.annotation.notesPlaceholder')}
                rows={4}
                className="input resize-none"
              />
            </div>

            {/* Turn-level tags */}
            {selectedMessageId && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  {t('moderation.annotation.messageTags')}
                </label>
                <div className="flex flex-wrap gap-1">
                  {messageTags.map(tag => (
                    <button
                      key={tag.id}
                      className="badge text-xs cursor-pointer hover:opacity-80"
                      style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                    >
                      {tag.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Debug / technical trace for selected message */}
            {selectedMessageId && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Системні промпти та послідовність інструментів/пошуку
                </label>
                {selectedMessage?.role === 'assistant' ? (
                  <TechnicalDetails message={selectedMessage} isExpanded={true} />
                ) : (
                  <p className="text-xs text-neutral-500">
                    Оберіть відповідь асистента, щоб побачити технічні деталі.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="p-4 border-t border-neutral-100 space-y-3">
            <button
              onClick={handleSaveAnnotation}
              className="btn-primary w-full"
              disabled={!canModerate}
            >
              <Save className="w-4 h-4 mr-2" />
              {t('moderation.annotation.save')}
            </button>
            <button
              onClick={handleMarkComplete}
              disabled={!canModerate || selectedSession.moderationStatus === 'moderated'}
              className="btn-secondary w-full"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              {t('moderation.annotation.markComplete')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
