import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ChatMessage } from '../../types';
import {
  Heart,
  User,
  MessageSquare,
  Settings,
  ChevronDown,
  ChevronRight,
  ScrollText
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { TechnicalDetails } from '../../components/TechnicalDetails';
import { useAuthStore } from '../../stores/authStore';
import type { AgentMemorySystemMessage } from '../../types/agentMemory';

interface MessageBubbleProps {
  message: ChatMessage;
  onFeedback?: (rating: 'positive' | 'negative' | 'detailed') => void;
  onRetry?: () => void;
}

function CollapsedChatSection(props: {
  title: string;
  icon?: ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const { title, icon, isOpen, onToggle, children } = props;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-neutral-200 bg-neutral-50 hover:bg-neutral-100 text-left"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2">
          {icon ? <span className="shrink-0">{icon}</span> : null}
          <span className="text-xs font-medium text-neutral-700">{title}</span>
        </div>
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-neutral-500" />
        ) : (
          <ChevronRight className="w-4 h-4 text-neutral-500" />
        )}
      </button>
      {isOpen ? (
        <div className="mt-2 rounded-xl border border-neutral-200 bg-white px-3 py-2">{children}</div>
      ) : null}
    </div>
  );
}

export default function MessageBubble({ message, onFeedback, onRetry }: MessageBubbleProps) {
  const { t } = useTranslation();
  const [showTechDetails, setShowTechDetails] = useState(false);
  const [systemExpanded, setSystemExpanded] = useState(false);
  const [showSystemPrompts, setShowSystemPrompts] = useState(false);
  const isSystem = message.role === 'system';
  const isAssistant = message.role === 'assistant';
  const isUser = message.role === 'user';
  const hasFeedback = message.feedback !== null && message.feedback !== undefined;
  const clientStatus = message.metadata?.client?.status;
  const isFailed = isUser && clientStatus === 'failed';
  const canRetry = isFailed && (message.metadata?.client?.retryable ?? true) && typeof onRetry === 'function';
  const { user } = useAuthStore();
  const hasExtendedPermissions = user && (
    ['qa_specialist', 'researcher', 'supervisor', 'moderator', 'owner'].includes(user.role) ||
    (user as any).isTestUser === true
  );

  const systemPrompts = (message.metadata as any)?.systemPrompts as
    | {
        agentMemorySystemMessages?: AgentMemorySystemMessage[];
      }
    | undefined;
  const hasSystemPrompts = !!systemPrompts && !!systemPrompts.agentMemorySystemMessages?.length;

  if (isSystem) {
    const raw = (message.content || '').trim();
    const parts = raw.split(/\n{2,}/g).map((p) => p.trim()).filter(Boolean);
    const headerLine = parts.length > 0 ? parts[0] : 'System';
    const bodyParts = parts.slice(1);
    const isMemoryBlock =
      headerLine.toUpperCase().startsWith('USER MEMORY') || headerLine.toUpperCase().startsWith('MEMORY UPDATED');
    const isExpanded = isMemoryBlock ? systemExpanded : true;

    return (
      <div className="flex justify-center animate-slide-up">
        <div className="w-full max-w-3xl">
          <div className="bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold tracking-wide text-neutral-600 uppercase">
                  System
                </span>
                <span className="text-neutral-300">•</span>
                <span className="text-[11px] text-neutral-500">
                  {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              {isMemoryBlock && (
                <button
                  type="button"
                  onClick={() => setSystemExpanded((v) => !v)}
                  className="text-xs text-neutral-600 hover:text-neutral-800 flex items-center gap-1"
                  aria-expanded={isExpanded}
                >
                  {isExpanded ? (
                    <>
                      <ChevronDown className="w-4 h-4" />
                      <span>{t('common.hide', 'Hide')}</span>
                    </>
                  ) : (
                    <>
                      <ChevronRight className="w-4 h-4" />
                      <span>{t('common.show', 'Show')}</span>
                    </>
                  )}
                </button>
              )}
            </div>

            <div className="mt-2 text-sm font-medium text-neutral-800 whitespace-pre-wrap break-words">
              {headerLine}
            </div>

            {!isExpanded && bodyParts.length > 0 && (
              <div className="mt-2 text-xs text-neutral-500">
                {t('chat.memoryCollapsedHint', '{{count}} blocks', { count: bodyParts.length })}
              </div>
            )}

            {isExpanded && bodyParts.length > 0 && (
              <div className="mt-3 space-y-2">
                {bodyParts.map((p, idx) => (
                  <div key={idx} className="bg-white border border-neutral-200 rounded-xl px-3 py-2">
                    <pre className="text-xs text-neutral-700 whitespace-pre-wrap break-words font-sans">
                      {p}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-start gap-3 ${isAssistant ? '' : 'flex-row-reverse'} animate-slide-up`}>
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
        isAssistant 
          ? 'bg-primary-100' 
          : 'bg-secondary-100'
      }`}>
        {isAssistant ? (
          <Heart className="w-4 h-4 text-primary-600" />
        ) : (
          <User className="w-4 h-4 text-secondary-600" />
        )}
      </div>

      {/* Message content */}
      <div className={`max-w-[80%] ${isAssistant ? '' : 'text-right'}`}>
        {/* Label */}
        <div className={`flex items-center gap-2 mb-1 text-xs text-neutral-500 ${
          isAssistant ? '' : 'justify-end'
        }`}>
          <span className="font-medium">
            {isAssistant ? t('chat.messages.assistant') : t('chat.messages.you')}
          </span>
          <span>
            {new Date(message.timestamp).toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </span>
        </div>

        {/* Bubble */}
        <div className={`rounded-2xl px-4 py-3 ${
          isAssistant 
            ? 'bg-white rounded-tl-sm shadow-soft border border-neutral-200/60' 
            : isFailed
              ? 'bg-error/10 text-error rounded-tr-sm shadow-soft border border-red-200'
              : 'bg-primary-500 text-white rounded-tr-sm shadow-soft'
        }`}>
          {isAssistant ? (
            <div className="prose prose-sm max-w-none prose-p:my-2 prose-ul:my-2 prose-li:my-0.5">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            </div>
          ) : (
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          )}
        </div>

        {isFailed && (
          <div className={`mt-2 flex items-center gap-2 text-xs ${isAssistant ? '' : 'justify-end'}`}>
            <span className="text-error">{t('chat.error.sendFailed', 'Failed to send')}</span>
            {canRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="text-xs text-error underline hover:no-underline"
              >
                {t('chat.error.retry', 'Retry')}
              </button>
            )}
          </div>
        )}

        {/* Feedback button + debug toggle (assistant only) */}
        {isAssistant && (
          <div className="flex items-center gap-1 mt-2">
            {onFeedback && (
              <button
                onClick={() => onFeedback('detailed')}
                className={`p-1.5 rounded-lg transition-colors ${
                  hasFeedback
                    ? 'bg-primary-100 text-primary-600'
                    : 'hover:bg-neutral-100 text-neutral-400 hover:text-primary-600'
                }`}
                title={t('chat.messages.giveFeedback')}
              >
                <MessageSquare className="w-4 h-4" />
              </button>
            )}

            {/* Hide gear for users without extended permissions */}
            {hasExtendedPermissions && (
              <button
                onClick={() => setShowTechDetails(!showTechDetails)}
                className={`p-1.5 rounded-lg transition-colors ${
                  showTechDetails
                    ? 'bg-neutral-200 text-neutral-600'
                    : 'hover:bg-neutral-100 text-neutral-400 hover:text-neutral-600'
                }`}
                title="Technical Details"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}

            {/* Feedback indicator */}
            {hasFeedback && (
              <span className="text-xs text-neutral-400 ml-2">
                {message.feedback?.comment ? t('chat.messages.feedbackSubmitted') : t('chat.messages.thanks')}
              </span>
            )}
          </div>
        )}

        {/* Technical Details (inline, per message) - Only shown for users with extended permissions */}
        {hasExtendedPermissions && <TechnicalDetails message={message} isExpanded={showTechDetails} />}

        {/* Collapsed "message-like" sections for extended users */}
        {isAssistant && hasExtendedPermissions && hasSystemPrompts && (
          <CollapsedChatSection
            title={t('chat.debug.systemPrompts', 'System prompts')}
            icon={<ScrollText className="w-4 h-4 text-primary-600" />}
            isOpen={showSystemPrompts}
            onToggle={() => setShowSystemPrompts((v) => !v)}
          >
            <div className="space-y-2">
              <div className="text-xs text-neutral-600">
                {t('chat.debug.agentMemorySystemMessages', 'Agent memory system messages')}:{' '}
                {systemPrompts?.agentMemorySystemMessages?.length ?? 0}
              </div>
              {(systemPrompts?.agentMemorySystemMessages || []).map((m, idx) => (
                <div key={idx} className="border border-neutral-200 rounded-lg overflow-hidden">
                  <div className="px-2 py-1 bg-neutral-50 text-[11px] text-neutral-600 font-mono">
                    #{idx + 1}
                    {m.meta?.kind ? ` • ${m.meta.kind}` : ''}
                  </div>
                  <pre className="px-2 py-2 text-xs text-neutral-700 whitespace-pre-wrap break-words">
                    {m.content}
                  </pre>
                </div>
              ))}
            </div>
          </CollapsedChatSection>
        )}

        {/* Tags (if any) */}
        {message.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {message.tags.map(tag => (
              <span key={tag} className="badge-info text-xs">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
