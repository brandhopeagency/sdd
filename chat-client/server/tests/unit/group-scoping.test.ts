/// <reference types="vitest/globals" />

import { vi } from 'vitest';

vi.mock('../../src/db', () => ({
  query: vi.fn(),
  transaction: vi.fn(),
  getPool: vi.fn()
}));

import { dbUserToAuthUser } from '../../src/types';
import { getPool } from '../../src/db';
import { listGroupSessions } from '../../src/services/groupSessions.service';

describe('group scoping / anonymization', () => {
  it('dbUserToAuthUser() should propagate groupId', () => {
    const user = dbUserToAuthUser({
      id: '00000000-0000-0000-0000-000000000001',
      email: 'a@example.com',
      display_name: 'A',
      role: 'group_admin' as any,
      status: 'active',
      group_id: '00000000-0000-0000-0000-000000000999',
      session_count: 0,
      last_login_at: null,
      metadata: {},
      created_at: new Date('2026-01-01T00:00:00Z'),
      updated_at: new Date('2026-01-01T00:00:00Z')
    } as any);

    expect(user.groupId).toBe('00000000-0000-0000-0000-000000000999');
  });

  it('listGroupSessions() should not search by user_id', async () => {
    const poolQuery = vi.fn();
    vi.mocked(getPool).mockReturnValue({ query: poolQuery } as any);

    poolQuery.mockResolvedValueOnce({ rows: [{ total: 0 }] });
    poolQuery.mockResolvedValueOnce({ rows: [] });

    await listGroupSessions('00000000-0000-0000-0000-000000000999', { search: 'abc' });

    const secondCallSql = poolQuery.mock.calls.at(-1)?.[0] as string;
    expect(secondCallSql).toContain('s.dialogflow_session_id ILIKE');
    expect(secondCallSql).not.toContain('s.user_id::text ILIKE');
  });
});

