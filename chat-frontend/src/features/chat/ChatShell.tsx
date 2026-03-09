/**
 * Chat surface shell — renders the chat interface.
 *
 * Auth wrapping (ProtectedRoute) is applied in App.tsx, not here.
 * The parent route already matches /chat and /chat/:sessionId, so
 * this component simply renders ChatInterface without nested routing.
 */

import ChatInterface from './ChatInterface';

export default function ChatShell() {
  return <ChatInterface />;
}
