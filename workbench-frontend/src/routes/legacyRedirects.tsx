/**
 * Handles redirects for old / cross-surface routes.
 *
 * Chat paths that land on the workbench domain are redirected to the
 * external chat app, preserving the sub-path, query string, and hash.
 */

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { CHAT_URL } from '../config';

export function ChatRedirect() {
  const location = useLocation();

  useEffect(() => {
    const target = `${CHAT_URL}${location.pathname}${location.search}${location.hash}`;
    window.location.replace(target);
  }, [location.pathname, location.search, location.hash]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <p className="text-gray-500">Redirecting to chat…</p>
    </div>
  );
}
