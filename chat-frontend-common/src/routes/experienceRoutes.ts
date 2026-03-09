/**
 * Surface detection and canonical route configuration.
 *
 * The app detects which surface it's on based on the hostname:
 * - hostnames starting with "workbench." → workbench surface
 * - everything else → chat surface
 */

export type Surface = 'chat' | 'workbench';

export function getSurface(): Surface {
  if (typeof window !== 'undefined' && window.location.hostname.startsWith('workbench.')) {
    return 'workbench';
  }
  return 'chat';
}

export function getSurfaceEntry(): string {
  return getSurface() === 'workbench' ? '/workbench' : '/chat';
}

export const SURFACE_ROUTES = {
  chat: {
    entry: '/chat',
    routes: ['/chat', '/chat/:sessionId'],
  },
  workbench: {
    entry: '/workbench',
    routes: [
      '/workbench',
      '/workbench/users',
      '/workbench/groups',
      '/workbench/approvals',
      '/workbench/group',
      '/workbench/research',
      '/workbench/privacy',
      '/workbench/settings',
    ],
  },
} as const;
