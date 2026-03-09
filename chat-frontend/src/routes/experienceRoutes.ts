/**
 * Route configuration for the chat application.
 */

export type Surface = 'chat';

export function getSurface(): Surface {
  return 'chat';
}

export function getSurfaceEntry(): string {
  return '/chat';
}

export const SURFACE_ROUTES = {
  chat: {
    entry: '/chat',
    routes: ['/chat', '/chat/:sessionId'],
  },
} as const;
