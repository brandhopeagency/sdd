/// <reference types="vitest/globals" />

import { vi } from 'vitest';

vi.mock('../../src/db', () => ({
  query: vi.fn(),
  transaction: vi.fn()
}));

vi.mock('../../src/services/auth.service', () => ({
  logAuditEvent: vi.fn()
}));

import { query } from '../../src/db';
import { logAuditEvent } from '../../src/services/auth.service';
import {
  createInviteCode,
  listUserGroupMemberships,
  resolveUserGroupContext,
  setActiveGroup,
  setGroupMembershipRole,
  rejectGroupRequest
} from '../../src/services/groupMembership.service';

describe('groupMembership.service (coverage)', () => {
  beforeEach(() => {
    vi.mocked(query).mockReset();
    vi.mocked(logAuditEvent).mockReset();
  });

  it('listUserGroupMemberships returns active + pending memberships (non-archived groups)', async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        { group_id: 'g1', group_name: 'Alpha', role: 'admin', status: 'active' },
        { group_id: 'g2', group_name: 'Beta', role: 'member', status: 'pending' }
      ]
    } as any);

    const out = await listUserGroupMemberships('u1');
    expect(out).toEqual([
      { groupId: 'g1', groupName: 'Alpha', role: 'admin', status: 'active' },
      { groupId: 'g2', groupName: 'Beta', role: 'member', status: 'pending' }
    ]);
  });

  it('resolveUserGroupContext prefers explicit active_group_id when membership is active', async () => {
    // getUserActiveGroupId
    vi.mocked(query).mockResolvedValueOnce({ rows: [{ active_group_id: 'g2' }] } as any);
    // listUserGroupMemberships
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        { group_id: 'g1', group_name: 'Alpha', role: 'admin', status: 'active' },
        { group_id: 'g2', group_name: 'Beta', role: 'member', status: 'active' }
      ]
    } as any);

    const ctx = await resolveUserGroupContext('u1');
    expect(ctx.activeGroupId).toBe('g2');
    expect(ctx.groupRole).toBe('member');
    expect(ctx.memberships).toHaveLength(2);
  });

  it('resolveUserGroupContext falls back to first active membership when active_group_id missing/invalid', async () => {
    // active_group_id points to non-active membership -> fallback
    vi.mocked(query).mockResolvedValueOnce({ rows: [{ active_group_id: 'gX' }] } as any);
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        { group_id: 'g1', group_name: 'Alpha', role: 'admin', status: 'active' },
        { group_id: 'g2', group_name: 'Beta', role: 'member', status: 'pending' }
      ]
    } as any);

    const ctx = await resolveUserGroupContext('u1');
    expect(ctx.activeGroupId).toBe('g1');
    expect(ctx.groupRole).toBe('admin');
  });

  it('setActiveGroup throws when user has no active membership', async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [{ status: 'pending' }] } as any);
    await expect(setActiveGroup('u1', 'g1', 'u1')).rejects.toThrow('NO_ACTIVE_MEMBERSHIP');
  });

  it('setActiveGroup updates users.active_group_id and audits', async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [{ status: 'active' }] } as any);
    vi.mocked(query).mockResolvedValueOnce({ rows: [] } as any);
    vi.mocked(logAuditEvent).mockResolvedValueOnce(undefined as any);

    const out = await setActiveGroup('u1', 'g1', 'u1', '1.2.3.4');
    expect(out).toEqual({ activeGroupId: 'g1' });
    expect(vi.mocked(logAuditEvent)).toHaveBeenCalled();
  });

  it('createInviteCode validates expiresAt and writes row + audits', async () => {
    await expect(createInviteCode({ groupId: 'g1', expiresAt: 'not-a-date' }, 'u1')).rejects.toThrow('INVALID_EXPIRES_AT');

    vi.mocked(query).mockResolvedValueOnce({ rows: [] } as any);
    vi.mocked(logAuditEvent).mockResolvedValueOnce(undefined as any);

    const invite = await createInviteCode({ groupId: 'g1', maxUses: 2, expiresAt: null }, 'u1', '1.2.3.4');
    expect(invite.groupId).toBe('g1');
    expect(invite.maxUses).toBe(2);
    expect(invite.code).toMatch(/^[A-Z2-9]{12}$/);
    expect(invite.expiresAt).toBeNull();
  });

  it('setGroupMembershipRole upserts membership, sets active group if empty, and audits', async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [] } as any); // upsert
    vi.mocked(query).mockResolvedValueOnce({ rows: [] } as any); // set active group
    vi.mocked(logAuditEvent).mockResolvedValueOnce(undefined as any);

    await expect(setGroupMembershipRole({ groupId: 'g1', userId: 'u2', role: 'admin' }, 'u1')).resolves.toEqual({ ok: true });
    expect(vi.mocked(logAuditEvent)).toHaveBeenCalled();
  });

  it('rejectGroupRequest updates membership and audits', async () => {
    vi.mocked(query).mockResolvedValueOnce({ rowCount: 1, rows: [] } as any);
    vi.mocked(logAuditEvent).mockResolvedValueOnce(undefined as any);

    await expect(rejectGroupRequest({ groupId: 'g1', userId: 'u2' }, 'u1')).resolves.toEqual({ ok: true });
    expect(vi.mocked(logAuditEvent)).toHaveBeenCalled();
  });
});

