/// <reference types="vitest/globals" />

import { vi } from 'vitest';

vi.mock('../../src/db', () => ({
  query: vi.fn(),
  transaction: vi.fn()
}));

vi.mock('../../src/services/auth.service', () => ({
  logAuditEvent: vi.fn()
}));

import { transaction } from '../../src/db';
import { approveGroupRequest, requestMembershipWithInviteCode } from '../../src/services/groupMembership.service';

describe('groupMembership invites', () => {
  it('requestMembershipWithInviteCode does NOT increment invite uses', async () => {
    const client = { query: vi.fn() } as any;

    // invite row (FOR UPDATE)
    client.query.mockResolvedValueOnce({
      rows: [
        {
          id: 'inv1',
          group_id: 'g1',
          revoked_at: null,
          expires_at: null,
          max_uses: 1,
          uses: 0
        }
      ]
    });
    // group not archived
    client.query.mockResolvedValueOnce({ rows: [{ ok: true }] });
    // existing membership none
    client.query.mockResolvedValueOnce({ rows: [] });
    // insert membership pending
    client.query.mockResolvedValueOnce({ rows: [] });

    vi.mocked(transaction).mockImplementation(async (cb: any) => cb(client));

    await requestMembershipWithInviteCode({ userId: 'u1', code: 'ABCD' }, '1.2.3.4');

    const sqlCalls = client.query.mock.calls.map((c: any[]) => String(c[0]));
    expect(sqlCalls.some((s) => s.includes('UPDATE group_invite_codes SET uses'))).toBe(false);
  });

  it('approveGroupRequest claims invite use at approval time', async () => {
    const client = { query: vi.fn() } as any;

    // SELECT pending membership metadata FOR UPDATE
    client.query.mockResolvedValueOnce({
      rows: [{ metadata: { source: 'invite', inviteCodeId: 'inv1' } }]
    });
    // claim invite use
    client.query.mockResolvedValueOnce({ rows: [{ id: 'inv1' }] });
    // UPDATE membership active
    client.query.mockResolvedValueOnce({ rowCount: 1, rows: [] });
    // UPDATE user active (if pending)
    client.query.mockResolvedValueOnce({ rowCount: 1, rows: [] });

    vi.mocked(transaction).mockImplementation(async (cb: any) => cb(client));

    await approveGroupRequest({ groupId: 'g1', userId: 'u1' }, 'admin1');

    const sqlCalls = client.query.mock.calls.map((c: any[]) => String(c[0]));
    expect(sqlCalls.some((s) => s.includes('UPDATE group_invite_codes') && s.includes('uses = uses + 1'))).toBe(true);
  });

  it('approveGroupRequest fails when invite cannot be claimed', async () => {
    const client = { query: vi.fn() } as any;

    client.query.mockResolvedValueOnce({
      rows: [{ metadata: { source: 'invite', inviteCodeId: 'inv1' } }]
    });
    // claim invite use -> fails (max uses reached / expired / revoked)
    client.query.mockResolvedValueOnce({ rows: [] });

    vi.mocked(transaction).mockImplementation(async (cb: any) => cb(client));

    await expect(approveGroupRequest({ groupId: 'g1', userId: 'u1' }, 'admin1')).rejects.toThrow('INVITE_NOT_AVAILABLE');

    const sqlCalls = client.query.mock.calls.map((c: any[]) => String(c[0]));
    expect(sqlCalls.some((s) => s.includes('UPDATE group_memberships') && s.includes("SET status = 'active'"))).toBe(false);
  });
});

