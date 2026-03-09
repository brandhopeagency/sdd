/// <reference types="vitest/globals" />

import { vi } from 'vitest';

vi.mock('../../src/db', () => ({
  getPool: vi.fn(),
}));

vi.mock('../../src/services/anonymization.service', () => ({
  getAnonymousSessionId: vi.fn((id: string) => `CHAT-${id}`),
  generateAnonymousId: vi.fn((id: string) => `USER-${id}`),
}));

vi.mock('../../src/services/reviewNotification.service', () => ({
  createNotification: vi.fn(async () => undefined),
}));

import { getPool } from '../../src/db';
import { canAccessGroupScopedQueue, getQueueCounts, listQueueSessions } from '../../src/services/reviewQueue.service';

describe('review queue group scoping', () => {
  it('checks active membership access for scoped queue', async () => {
    const poolQuery = vi.fn();
    vi.mocked(getPool).mockReturnValue({ query: poolQuery } as any);

    poolQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
    const hasAccess = await canAccessGroupScopedQueue(
      '00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000010',
    );
    expect(hasAccess).toBe(true);

    poolQuery.mockResolvedValueOnce({ rows: [] });
    const noAccess = await canAccessGroupScopedQueue(
      '00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000011',
    );
    expect(noAccess).toBe(false);
  });

  it('passes optional group scope into queue counts query', async () => {
    const poolQuery = vi.fn();
    vi.mocked(getPool).mockReturnValue({ query: poolQuery } as any);
    poolQuery.mockResolvedValueOnce({
      rows: [{ pending: 1, flagged: 2, in_progress: 3, completed: 4 }],
    });

    const counts = await getQueueCounts(
      '00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000099',
    );

    expect(counts).toEqual({ pending: 1, flagged: 2, inProgress: 3, completed: 4 });
    expect(poolQuery).toHaveBeenCalledTimes(1);
    const [sql, values] = poolQuery.mock.calls[0];
    expect(sql).toContain('s.group_id = $2::uuid');
    expect(values).toEqual([
      '00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000099',
    ]);
  });

  it('applies group filter in listQueueSessions queries', async () => {
    const poolQuery = vi.fn();
    vi.mocked(getPool).mockReturnValue({ query: poolQuery } as any);

    // getQueueCounts
    poolQuery.mockResolvedValueOnce({
      rows: [{ pending: 0, flagged: 0, in_progress: 0, completed: 0 }],
    });
    // total count
    poolQuery.mockResolvedValueOnce({ rows: [{ total: 0 }] });
    // list rows
    poolQuery.mockResolvedValueOnce({ rows: [] });

    await listQueueSessions({
      reviewerId: '00000000-0000-0000-0000-000000000001',
      groupId: '00000000-0000-0000-0000-000000000077',
      page: 1,
      pageSize: 20,
      tab: 'pending',
    });

    const sqls = poolQuery.mock.calls.map((call) => String(call[0]));
    const hasGroupWhere = sqls.some((sql) => sql.includes('s.group_id = $'));
    expect(hasGroupWhere).toBe(true);

    const countCallValues = poolQuery.mock.calls[1][1] as unknown[];
    expect(countCallValues).toContain('00000000-0000-0000-0000-000000000077');
  });
});
