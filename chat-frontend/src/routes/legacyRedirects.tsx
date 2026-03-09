/**
 * Handles redirects for old / cross-surface routes.
 *
 * Workbench paths that land on the chat domain are redirected to the
 * external workbench app, preserving the sub-path, query string, and hash.
 */

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { WORKBENCH_URL } from '@/config';

export function WorkbenchRedirect() {
  const location = useLocation();

  useEffect(() => {
    const target = `${WORKBENCH_URL}${location.pathname}${location.search}${location.hash}`;
    window.location.href = target;
  }, [location]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <p className="text-gray-500">Redirecting to workbench…</p>
    </div>
  );
}
