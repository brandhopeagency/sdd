/// <reference types="vitest/globals" />

import { vi } from 'vitest';

vi.mock('../../src/db', () => ({
  query: vi.fn(),
  transaction: vi.fn(),
  getPool: vi.fn()
}));

vi.mock('../../src/services/auth.service', () => ({
  logAuditEvent: vi.fn(),
}));

import { query, getPool } from '../../src/db';
import { getUsers } from '../../src/services/user.service';
import { listAdminSessions } from '../../src/services/sessionModeration.service';

describe('PII permission: avoid PII search/sort without DATA_VIEW_PII', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getUsers() should not search/sort by email/display_name when includePiiSearch/includePiiSort are false', async () => {
    const queryMock = vi.mocked(query);

    queryMock.mockResolvedValueOnce({ rows: [{ total: '0' }] } as any);
    queryMock.mockResolvedValueOnce({ rows: [] } as any);

    await getUsers(
      { search: 'alice@example.com', sortBy: 'email', sortOrder: 'asc', page: 1, limit: 10 },
      { includePiiSearch: false, includePiiSort: false }
    );

    const secondCallSql = queryMock.mock.calls.at(-1)?.[0] as string;
    expect(secondCallSql).toContain('id::text ILIKE');
    expect(secondCallSql).not.toContain('email ILIKE');
    expect(secondCallSql).not.toContain('display_name ILIKE');
    expect(secondCallSql).toContain('ORDER BY created_at ASC');
  });

  it('getUsers() should use email/display_name search/sort when allowed', async () => {
    const queryMock = vi.mocked(query);

    queryMock.mockResolvedValueOnce({ rows: [{ total: '0' }] } as any);
    queryMock.mockResolvedValueOnce({ rows: [] } as any);

    await getUsers(
      { search: 'alice@example.com', sortBy: 'email', sortOrder: 'asc', page: 1, limit: 10 },
      { includePiiSearch: true, includePiiSort: true }
    );

    const secondCallSql = queryMock.mock.calls.at(-1)?.[0] as string;
    expect(secondCallSql).toContain('email ILIKE');
    expect(secondCallSql).toContain('display_name ILIKE');
    expect(secondCallSql).toContain('ORDER BY email ASC');
  });

  it('getUsers() should apply testUsersOnly filter and expose isTestUser marker', async () => {
    const queryMock = vi.mocked(query);

    queryMock.mockResolvedValueOnce({ rows: [{ total: '1' }] } as any);
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          id: 'u-1',
          email: 'qa@example.com',
          display_name: 'QA User',
          role: 'user',
          status: 'active',
          group_id: null,
          approved_by: null,
          approved_at: null,
          disapproved_at: null,
          disapproval_comment: null,
          disapproval_count: 0,
          active_group_id: null,
          session_count: 0,
          last_login_at: null,
          metadata: {},
          created_at: new Date(),
          updated_at: new Date(),
          is_test_user: true,
        },
      ],
    } as any);

    const result = await getUsers({ page: 1, limit: 10, testUsersOnly: true });

    const countSql = queryMock.mock.calls[0]?.[0] as string;
    const listSql = queryMock.mock.calls[1]?.[0] as string;
    expect(countSql).toContain('LOWER(td.name) = LOWER($1)');
    expect(listSql).toContain('AS is_test_user');
    expect(result.users[0]?.isTestUser).toBe(true);
  });

  it('listAdminSessions() should not search by u.email/u.display_name when includePiiSearch is false', async () => {
    const poolQuery = vi.fn();
    vi.mocked(getPool).mockReturnValue({ query: poolQuery } as any);

    poolQuery.mockResolvedValueOnce({ rows: [{ total: 0 }] });
    poolQuery.mockResolvedValueOnce({ rows: [] });

    await listAdminSessions({ search: 'alice' }, { includePiiSearch: false });

    const secondCallSql = poolQuery.mock.calls.at(-1)?.[0] as string;
    expect(secondCallSql).toContain('s.user_id::text ILIKE');
    expect(secondCallSql).toContain('s.dialogflow_session_id ILIKE');
    expect(secondCallSql).not.toContain('u.display_name ILIKE');
    expect(secondCallSql).not.toContain('u.email ILIKE');
  });

  it('listAdminSessions() should search by u.email/u.display_name when includePiiSearch is true', async () => {
    const poolQuery = vi.fn();
    vi.mocked(getPool).mockReturnValue({ query: poolQuery } as any);

    poolQuery.mockResolvedValueOnce({ rows: [{ total: 0 }] });
    poolQuery.mockResolvedValueOnce({ rows: [] });

    await listAdminSessions({ search: 'alice' }, { includePiiSearch: true });

    const secondCallSql = poolQuery.mock.calls.at(-1)?.[0] as string;
    expect(secondCallSql).toContain('u.display_name ILIKE');
    expect(secondCallSql).toContain('u.email ILIKE');
  });
});

