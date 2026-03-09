import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Calendar, MessageSquare } from 'lucide-react';
import { groupAdminApi } from '../../../services/api';
import { useAuthStore } from '../../../stores/authStore';
import type { ChatMessage } from '../../../types';
import MessageBubble from '../../chat/MessageBubble';

function storedConversationToChatMessages(
  conversation: import('../../../types/conversation').StoredConversation
): ChatMessage[] {
  return conversation.messages.map((m) => {
    const ts = new Date(m.timestamp);
    return {
      id: m.id,
      sessionId: conversation.sessionId,
      role: m.role,
      content: m.content,
      timestamp: ts,
      feedback: m.feedback
        ? {
            rating: m.feedback.rating,
            comment: m.feedback.comment,
            submittedAt: new Date(m.feedback.submittedAt)
          }
        : null,
      metadata: {
        intent: m.intent?.displayName,
        confidence: m.intent?.confidence,
        responseTimeMs: m.responseTimeMs,
        parameters: m.match?.parameters,
        intentInfo: m.intent as any,
        match: m.match as any,
        generativeInfo: m.generativeInfo as any,
        webhookStatuses: m.webhookStatuses as any,
        diagnosticInfo: m.diagnosticInfo as any,
        sentiment: m.sentiment as any,
        flowInfo: m.flowInfo as any,
        systemPrompts: (m as any).systemPrompts
      },
      tags: [],
      createdAt: ts,
      updatedAt: ts
    };
  });
}

export default function GroupConversationView() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { activeGroupId } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [messageCount, setMessageCount] = useState<number>(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const load = useMemo(
    () => async () => {
      if (!sessionId) return;
      if (!activeGroupId) {
        setError(t('group.sessions.noGroup'));
        setMessages([]);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const [sessionResp, convoResp] = await Promise.all([
          groupAdminApi.getSession(activeGroupId, sessionId),
          groupAdminApi.getConversation(activeGroupId, sessionId)
        ]);

        if (!sessionResp.success || !sessionResp.data) {
          setError(sessionResp.error?.message || t('common.error'));
          setMessages([]);
          return;
        }

        if (!convoResp.success || !convoResp.data) {
          setError(convoResp.error?.message || t('common.error'));
          setMessages([]);
          return;
        }

        setStartedAt(new Date(sessionResp.data.startedAt));
        setMessageCount(sessionResp.data.messageCount || 0);
        setMessages(storedConversationToChatMessages(convoResp.data));
      } catch (e) {
        console.error('[GroupConversation] Failed to load:', e);
        setError(t('common.error'));
        setMessages([]);
      } finally {
        setLoading(false);
      }
    },
    [activeGroupId, sessionId, t]
  );

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="h-full flex flex-col -m-6">
      <div className="bg-white border-b border-neutral-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/workbench/group/sessions')} className="btn-ghost">
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t('group.sessions.back')}
            </button>
            <div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm font-semibold text-neutral-700">{sessionId}</span>
              </div>
              <p className="text-sm text-neutral-500 mt-0.5 flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {startedAt ? startedAt.toLocaleDateString() : '-'}
                </span>
                <span className="flex items-center gap-1">
                  <MessageSquare className="w-4 h-4" />
                  {messageCount} {t('research.session.messages')}
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 bg-neutral-50">
        {error && !loading && (
          <div className="mb-6 card p-4 bg-red-50 border border-red-100 text-red-700 text-sm">{error}</div>
        )}
        {loading ? (
          <div className="card p-8 text-center text-neutral-500">{t('common.loading')}</div>
        ) : messages.length === 0 ? (
          <div className="card p-8 text-center text-neutral-500">{t('common.notFound')}</div>
        ) : (
          <div className="space-y-4">
            {messages.map((m) => (
              <div key={m.id} className="card p-3">
                <MessageBubble message={m} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

