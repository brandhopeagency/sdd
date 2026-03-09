/**
 * Registry of known legacy routes and their canonical destinations.
 */

export interface LegacyRoute {
  pattern: string;
  target: string;
  surface: 'chat' | 'workbench';
}

export const LEGACY_ROUTES: LegacyRoute[] = [
  // Hash-based routes (from old HashRouter)
  { pattern: '/#/chat', target: '/chat', surface: 'chat' },
  { pattern: '/#/workbench', target: '/workbench', surface: 'workbench' },
  { pattern: '/#/login', target: '/login', surface: 'chat' },
  // Workbench routes on chat domain
  { pattern: '/workbench', target: '/workbench', surface: 'workbench' },
  { pattern: '/workbench/users', target: '/workbench/users', surface: 'workbench' },
  { pattern: '/workbench/research', target: '/workbench/research', surface: 'workbench' },
  { pattern: '/workbench/settings', target: '/workbench/settings', surface: 'workbench' },
];

export function findLegacyRedirect(path: string): LegacyRoute | undefined {
  // Sort candidates by pattern length descending so more specific routes match first.
  const candidates = [...LEGACY_ROUTES].sort((a, b) => b.pattern.length - a.pattern.length);
  return candidates.find(r => path === r.pattern || path.startsWith(r.pattern + '/'));
}
