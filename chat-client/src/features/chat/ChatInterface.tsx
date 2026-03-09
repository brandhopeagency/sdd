import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore, useCanAccessWorkbench, useIsGuest } from '@/stores/authStore';
import { useChatStore } from '@/stores/chatStore';
import { Permission } from '@/types';
import { 
  Heart, LayoutDashboard, LogOut, User, 
  Send, RotateCcw, UserPlus, Loader2
} from 'lucide-react';
import MessageBubble from './MessageBubble';
import FeedbackModal from './FeedbackModal';
import RegisterPopup from '../../components/RegisterPopup';

export default function ChatInterface() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, logout } = useAuthStore();
  const canAccessWorkbench = useCanAccessWorkbench();
  const isGuest = useIsGuest();
  const canSeeMemoryUpdate = user?.permissions?.includes(Permission.CHAT_DEBUG) ?? false;
  
  const { 
    session, 
    messages, 
    isTyping, 
    agentMemory,
    memoryUpdateStatus,
    endSessionInBackground,
    beginMemoryUpdateWatcher,
    resumeMemoryUpdateWatcher,
    startSession, 
    endSession, 
    sendMessage,
    retryFailedMessage,
    submitFeedback
  } = useChatStore();
  
  const [input, setInput] = useState('');
  const [feedbackMessageId, setFeedbackMessageId] = useState<string | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showRegisterPopup, setShowRegisterPopup] = useState(false);
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [isStartingNewSession, setIsStartingNewSession] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!session) {
      // Properly handle async startSession to avoid race conditions
      const initSession = async () => {
        setIsStartingSession(true);
        try {
          await startSession(user?.id ?? null);
        } finally {
          setIsStartingSession(false);
        }
      };
      initSession();
    }
  }, [session, startSession, user?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    const onFocus = () => {
      if (useChatStore.getState().memoryUpdateStatus === 'failed') {
        useChatStore.getState().resumeMemoryUpdateWatcher();
      }
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, []);

  const handleSend = async () => {
    if (!input.trim()) return;
    if (!session || session.status !== 'active' || isTyping) return;
    // User interaction: resume background polling after a circuit breaker trip.
    if (memoryUpdateStatus === 'failed') {
      resumeMemoryUpdateWatcher();
    }
    const message = input;
    setInput('');
    // Keep the cursor in the input after sending (mouse click or Enter)
    inputRef.current?.focus();
    await sendMessage(message);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // If assistant is responding, don't send yet (user can keep typing)
      if (!isTyping) handleSend();
    }
  };

  const handleNewSession = async () => {
    if (isStartingNewSession) return;
    try {
      setIsStartingNewSession(true);
      const previousSessionId = session?.id || null;
      const baselineUpdatedAt = (() => {
        if (!agentMemory || agentMemory.length === 0) return null;
        let max: string | null = null;
        for (const m of agentMemory) {
          const ts = m?.meta?.updatedAt;
          if (typeof ts !== 'string' || !ts) continue;
          if (!max || new Date(ts).getTime() > new Date(max).getTime()) max = ts;
        }
        return max;
      })();

      // Non-blocking: end the previous session in background (best-effort)
      if (previousSessionId) {
        if (previousSessionId.startsWith('sess_')) {
          await endSession();
        } else {
          void endSessionInBackground(previousSessionId);
        }
      }

      // Start a new session immediately
      await startSession(user?.id ?? null);

      // Start background watcher that refreshes memory into the active session when ready
      const newSessionId = useChatStore.getState().session?.id || null;
      if (newSessionId && !newSessionId.startsWith('sess_')) {
        beginMemoryUpdateWatcher({ sessionId: newSessionId, baselineUpdatedAt });
      }
    } catch (error) {
      console.error('[Chat] Failed to start new session:', error);
      // Even if previous end failed, try to start new session
      await startSession(user?.id ?? null);
    } finally {
      setIsStartingNewSession(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="h-screen flex flex-col bg-neutral-50">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-primary-400 to-primary-500 rounded-xl flex items-center justify-center shadow-soft">
            <Heart className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-semibold text-neutral-800">{t('chat.header.title')}</h1>
            <p className="text-xs text-neutral-500">{t('chat.header.subtitle')}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Workbench button - only for authorized roles */}
          {canAccessWorkbench && (
            <button
              onClick={() => navigate('/workbench')}
              className="btn-ghost"
              title={t('workbench.title')}
            >
              <LayoutDashboard className="w-5 h-5" />
            </button>
          )}

          {/* User menu / Guest registration */}
          {isGuest ? (
            // Guest mode - show "Guest" with "Register" link
            <button
              onClick={() => setShowRegisterPopup(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-primary-50 transition-colors border border-primary-200 bg-primary-50/50"
            >
              <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-primary-600" />
              </div>
              <div className="text-left">
                <span className="text-sm font-medium text-neutral-700 block">
                  {t('chat.guest')}
                </span>
                <span className="text-xs text-primary-600 flex items-center gap-1">
                  <UserPlus className="w-3 h-3" />
                  {t('chat.register')}
                </span>
              </div>
            </button>
          ) : (
            // Authenticated user menu
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-neutral-100 transition-colors"
              >
                <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-primary-600" />
                </div>
                <span className="text-sm font-medium text-neutral-700 hidden sm:block">
                  {user?.displayName}
                </span>
              </button>

              {showUserMenu && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setShowUserMenu(false)} 
                  />
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-neutral-200 py-2 z-20">
                    <div className="px-4 py-2 border-b border-neutral-100">
                      <p className="font-medium text-neutral-900">{user?.displayName}</p>
                      <p className="text-sm text-neutral-500">{user?.email}</p>
                      <span className="badge-info mt-1">{t(`roles.${user?.role}`)}</span>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="w-full px-4 py-2 text-left text-error hover:bg-error/10 flex items-center gap-2"
                    >
                      <LogOut className="w-4 h-4" />
                      {t('common.signOut')}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {isStartingSession && !session && (
            <div className="card p-6 flex items-center gap-3 text-neutral-600">
              <Loader2 className="w-5 h-5 animate-spin text-neutral-500" />
              <span className="text-sm">{t('chat.session.starting')}</span>
            </div>
          )}
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              onRetry={() => retryFailedMessage(message.id)}
              onFeedback={(rating) => {
                if (rating === 'detailed') {
                  setFeedbackMessageId(message.id);
                }
              }}
            />
          ))}
          
          {isTyping && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Heart className="w-4 h-4 text-primary-600" />
              </div>
              <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm border border-neutral-100">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-neutral-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-neutral-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-neutral-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input area */}
      <div className="bg-white border-t border-neutral-200 p-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-end gap-3">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('chat.input.placeholder')}
                rows={1}
                className="input resize-none pr-12 min-h-[48px] max-h-32"
                style={{ 
                  height: 'auto',
                  minHeight: '48px'
                }}
                // Never disable while typing, otherwise the browser blurs the field.
                disabled={!session || session.status !== 'active'}
              />
            </div>
            <button
              onClick={handleSend}
              disabled={!input.trim() || !session || session.status !== 'active' || isTyping}
              className="btn-primary px-4 py-3"
              aria-label="Send message"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>

          {/* Session controls */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-neutral-100">
            <button
              onClick={() => {
                endSession();
                navigate('/');
              }}
              className="btn-ghost text-neutral-500 text-sm"
            >
              {t('chat.session.end')}
            </button>
            <button
              onClick={handleNewSession}
              disabled={isStartingNewSession || isTyping || isStartingSession}
              className="btn-ghost text-sm"
            >
              {isStartingNewSession ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RotateCcw className="w-4 h-4 mr-2" />
              )}
              {t('chat.session.new')}
            </button>
          </div>

          {canSeeMemoryUpdate && memoryUpdateStatus === 'pending' && (
            <div className="mt-3 text-xs text-neutral-500">
              {t('chat.memory.updating', 'Updating memory in background…')}
            </div>
          )}
        </div>
      </div>

      {/* Feedback Modal */}
      {feedbackMessageId && (
        <FeedbackModal
          onSubmit={(rating, comment) => {
            submitFeedback(feedbackMessageId, rating, comment);
            setFeedbackMessageId(null);
          }}
          onClose={() => setFeedbackMessageId(null)}
        />
      )}

      {/* Register Popup for guests */}
      {showRegisterPopup && (
        <RegisterPopup onClose={() => setShowRegisterPopup(false)} />
      )}
    </div>
  );
}
