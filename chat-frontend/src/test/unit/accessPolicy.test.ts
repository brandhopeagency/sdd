/// <reference types="vitest/globals" />

import { evaluateAccess } from '@/services/accessPolicy';
import { Permission } from '@/types';

describe('accessPolicy – evaluateAccess', () => {
  it('allows access on chat surface regardless of permissions', () => {
    const result = evaluateAccess('chat', []);
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('allows access on chat surface with any permissions', () => {
    const result = evaluateAccess('chat', [Permission.CHAT_ACCESS]);
    expect(result.allowed).toBe(true);
  });
});
