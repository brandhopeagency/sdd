/**
 * Access policy evaluation for surface-level authorization.
 * In the chat-only app, all authenticated users are allowed.
 */

import { Permission } from '@/types';

export interface AccessPolicyResult {
  allowed: boolean;
  reason?: string;
  fallbackRoute?: string;
}

export function evaluateAccess(_surface: 'chat', _permissions: Permission[]): AccessPolicyResult {
  return { allowed: true };
}
