import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, RefreshCw, Trash2, ClipboardList } from 'lucide-react';
import { adminGroupsApi } from '@/services/adminApi';
import type { User } from '@mentalhelpglobal/chat-types';

interface GroupDto {
  id: string;
  name: string;
}

interface GroupMember extends User {
  membershipRole: 'member' | 'admin';
  membershipStatus: 'active' | 'pending';
}

interface InvitationCode {
  id: string;
  code: string;
  isActive: boolean;
  requiresApproval: boolean;
  expiresAt: string | null;
}

export default function GroupsView() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [groups, setGroups] = useState<GroupDto[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [members, setMembers] = useState<GroupMember[]>([]);
  const [invites, setInvites] = useState<InvitationCode[]>([]);

  const [newGroupName, setNewGroupName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [inviteExpiresAt, setInviteExpiresAt] = useState('');
  const [confirmRemoveMember, setConfirmRemoveMember] = useState<string | null>(null);
  const [inviteRequiresApproval, setInviteRequiresApproval] = useState(true);
  const [confirmDeactivateInvite, setConfirmDeactivateInvite] = useState<string | null>(null);

  const selectedGroup = useMemo(
    () => groups.find((g) => g.id === selectedGroupId) || null,
    [groups, selectedGroupId]
  );

  const loadGroups = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await adminGroupsApi.list();
      if (!resp.success || !resp.data) {
        setError(resp.error?.message || t('common.error'));
        setGroups([]);
        return;
      }
      setGroups(resp.data);
      if (!selectedGroupId && resp.data.length > 0) {
        setSelectedGroupId(resp.data[0].id);
      }
    } catch (e) {
      console.error('[Groups] Failed to load groups:', e);
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [selectedGroupId, t]);

  const loadGroupDetails = useCallback(async (groupId: string) => {
    setLoading(true);
    setError(null);
    try {
      const [membersResp, invitesResp] = await Promise.all([
        adminGroupsApi.listMembers(groupId, { limit: 50 }),
        adminGroupsApi.listInvites(groupId)
      ]);
      if (membersResp.success && membersResp.data) {
        setMembers(membersResp.data as GroupMember[]);
      } else {
        setMembers([]);
      }
      if (invitesResp.success && invitesResp.data) {
        setInvites(invitesResp.data as InvitationCode[]);
      } else {
        setInvites([]);
      }
    } catch (e) {
      console.error('[Groups] Failed to load group details:', e);
      setError(t('common.error'));
      setMembers([]);
      setInvites([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadGroups();
  }, [loadGroups]);

  useEffect(() => {
    if (selectedGroupId) {
      void loadGroupDetails(selectedGroupId);
    }
  }, [selectedGroupId, loadGroupDetails]);

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await adminGroupsApi.create(newGroupName.trim());
      if (!resp.success || !resp.data) {
        setError(resp.error?.message || t('common.error'));
        return;
      }
      setNewGroupName('');
      await loadGroups();
      setSelectedGroupId(resp.data.id);
    } catch (e) {
      console.error('[Groups] Failed to create group:', e);
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleRenameGroup = async () => {
    if (!selectedGroupId || !groupName.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await adminGroupsApi.update(selectedGroupId, groupName.trim());
      if (!resp.success || !resp.data) {
        setError(resp.error?.message || t('common.error'));
        return;
      }
      await loadGroups();
    } catch (e) {
      console.error('[Groups] Failed to rename group:', e);
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async () => {
    if (!selectedGroupId || !newMemberEmail.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await adminGroupsApi.addMember(selectedGroupId, { email: newMemberEmail.trim() });
      if (!resp.success) {
        setError(resp.error?.message || t('common.error'));
        return;
      }
      setNewMemberEmail('');
      await loadGroupDetails(selectedGroupId);
    } catch (e) {
      console.error('[Groups] Failed to add member:', e);
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!selectedGroupId) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await adminGroupsApi.removeMember(selectedGroupId, userId);
      if (!resp.success) {
        setError(resp.error?.message || t('common.error'));
        return;
      }
      await loadGroupDetails(selectedGroupId);
    } catch (e) {
      console.error('[Groups] Failed to remove member:', e);
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, role: 'member' | 'admin') => {
    if (!selectedGroupId) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await adminGroupsApi.setMemberRole(selectedGroupId, userId, role);
      if (!resp.success) {
        setError(resp.error?.message || t('common.error'));
        return;
      }
      await loadGroupDetails(selectedGroupId);
    } catch (e) {
      console.error('[Groups] Failed to update member role:', e);
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInvite = async () => {
    if (!selectedGroupId) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await adminGroupsApi.createInvite(selectedGroupId, {
        code: inviteCode.trim() || undefined,
        expiresAt: inviteExpiresAt || undefined,
        requiresApproval: inviteRequiresApproval
      });
      if (!resp.success) {
        setError(resp.error?.message || t('common.error'));
        return;
      }
      setInviteCode('');
      setInviteExpiresAt('');
      setInviteRequiresApproval(true);
      await loadGroupDetails(selectedGroupId);
    } catch (e) {
      console.error('[Groups] Failed to create invite:', e);
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivateInvite = async (codeId: string) => {
    if (!selectedGroupId) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await adminGroupsApi.deactivateInvite(selectedGroupId, codeId);
      if (!resp.success) {
        setError(resp.error?.message || t('common.error'));
        return;
      }
      await loadGroupDetails(selectedGroupId);
    } catch (e) {
      console.error('[Groups] Failed to deactivate invite:', e);
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedGroup) {
      setGroupName(selectedGroup.name);
    }
  }, [selectedGroup]);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-neutral-800">{t('groups.title')}</h1>
          <p className="text-neutral-500 mt-1 text-sm">{t('groups.subtitle')}</p>
        </div>
        <button
          onClick={() => void loadGroups()}
          className="btn-ghost flex items-center gap-2"
          disabled={loading}
        >
          <RefreshCw className="w-4 h-4" />
          {t('groups.refresh')}
        </button>
      </div>

      {error && <div className="card p-3 mb-4 text-sm text-red-700 bg-red-50">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-4">
          <h2 className="font-semibold text-neutral-800 mb-3">{t('groups.list')}</h2>
          <div className="space-y-2">
            {groups.map((group) => (
              <button
                key={group.id}
                onClick={() => setSelectedGroupId(group.id)}
                className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${
                  selectedGroupId === group.id
                    ? 'border-primary-300 bg-primary-50 text-primary-700'
                    : 'border-neutral-200 hover:bg-neutral-50'
                }`}
              >
                {group.name}
              </button>
            ))}
          </div>
          <div className="mt-4">
            <label className="block text-xs text-neutral-500 mb-1">{t('groups.create')}</label>
            <div className="flex gap-2">
              <input
                className="input flex-1"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder={t('groups.createPlaceholder')}
              />
              <button
                className="btn-primary"
                onClick={() => void handleCreateGroup()}
                disabled={loading || !newGroupName.trim()}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          {selectedGroup ? (
            <>
              <div className="card p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold text-neutral-800">{t('groups.details')}</h2>
                  <button
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary-700 bg-primary-50 border border-primary-200 rounded-md hover:bg-primary-100"
                    onClick={() => navigate(`/workbench/groups/${selectedGroupId}/surveys`)}
                  >
                    <ClipboardList className="w-4 h-4" />
                    {t('survey.groupSurveys.tab')}
                  </button>
                </div>
                <div className="flex flex-col md:flex-row gap-3">
                  <input
                    className="input flex-1"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                  />
                  <button className="btn-primary" onClick={() => void handleRenameGroup()} disabled={loading}>
                    {t('groups.rename')}
                  </button>
                </div>
              </div>

              <div className="card p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-neutral-800">{t('groups.members')}</h2>
                  <Users className="w-4 h-4 text-neutral-500" />
                </div>
                <div className="flex gap-2 mb-4">
                  <input
                    className="input flex-1"
                    value={newMemberEmail}
                    onChange={(e) => setNewMemberEmail(e.target.value)}
                    placeholder={t('groups.addMemberPlaceholder')}
                  />
                  <button
                    className="btn-primary"
                    onClick={() => void handleAddMember()}
                    disabled={loading || !newMemberEmail.trim()}
                  >
                    {t('groups.addMember')}
                  </button>
                </div>
                <div className="space-y-2">
                  {members.map((member) => (
                    <div key={member.id} className="flex items-center justify-between bg-neutral-50 px-3 py-2 rounded-lg">
                      <div>
                        <div className="text-sm font-medium text-neutral-800">{member.displayName}</div>
                        <div className="text-xs text-neutral-500">{member.email}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          className="input w-28"
                          value={member.membershipRole}
                          onChange={(e) => void handleRoleChange(member.id, e.target.value as 'member' | 'admin')}
                        >
                          <option value="member">{t('groups.memberRole')}</option>
                          <option value="admin">{t('groups.adminRole')}</option>
                        </select>
                        {confirmRemoveMember === member.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              className="btn-danger text-xs px-2 py-1 min-h-[36px]"
                              onClick={() => { void handleRemoveMember(member.id); setConfirmRemoveMember(null); }}
                              disabled={loading}
                            >
                              {t('common.confirm', 'Confirm')}
                            </button>
                            <button
                              className="btn-ghost text-xs px-2 py-1 min-h-[36px]"
                              onClick={() => setConfirmRemoveMember(null)}
                            >
                              {t('common.cancel', 'Cancel')}
                            </button>
                          </div>
                        ) : (
                          <button
                            className="btn-ghost text-error"
                            onClick={() => setConfirmRemoveMember(member.id)}
                            title={t('groups.removeMember')}
                            disabled={loading}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {members.length === 0 && <p className="text-sm text-neutral-500">{t('groups.noMembers')}</p>}
                </div>
              </div>

              <div className="card p-4">
                <h2 className="font-semibold text-neutral-800 mb-3">{t('groups.invites')}</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
                  <input
                    className="input"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())}
                    placeholder={t('groups.inviteCodePlaceholder')}
                  />
                  <input
                    className="input"
                    type="date"
                    value={inviteExpiresAt}
                    onChange={(e) => setInviteExpiresAt(e.target.value)}
                  />
                  <button className="btn-primary" onClick={() => void handleCreateInvite()} disabled={loading}>
                    {t('groups.createInvite')}
                  </button>
                </div>
                <label className="flex items-center gap-2 mb-4 text-sm text-neutral-600 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                    checked={inviteRequiresApproval}
                    onChange={(e) => setInviteRequiresApproval(e.target.checked)}
                  />
                  {t('groups.requiresApprovalToggle')}
                </label>
                <div className="space-y-2">
                  {invites.map((invite) => {
                    const expiryLabel = invite.expiresAt
                      ? new Date(invite.expiresAt).toLocaleDateString()
                      : null;
                    return (
                    <div key={invite.id} className="flex items-center justify-between bg-neutral-50 px-3 py-2 rounded-lg">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-neutral-800">{invite.code}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                            invite.requiresApproval
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-green-100 text-green-700'
                          }`}>
                            {invite.requiresApproval ? t('groups.requiresApproval') : t('groups.autoAdmit')}
                          </span>
                        </div>
                        <div className="text-xs text-neutral-500">
                          {expiryLabel ? t('groups.inviteExpires', { date: expiryLabel }) : t('groups.inviteNoExpiry')}
                        </div>
                      </div>
                      <div>
                        {invite.isActive ? (
                          confirmDeactivateInvite === invite.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                className="btn-danger text-xs px-2 py-1 min-h-[36px]"
                                onClick={() => { void handleDeactivateInvite(invite.id); setConfirmDeactivateInvite(null); }}
                                disabled={loading}
                              >
                                {t('common.confirm', 'Confirm')}
                              </button>
                              <button
                                className="btn-ghost text-xs px-2 py-1 min-h-[36px]"
                                onClick={() => setConfirmDeactivateInvite(null)}
                              >
                                {t('common.cancel', 'Cancel')}
                              </button>
                            </div>
                          ) : (
                            <button
                              className="btn-ghost text-error"
                              onClick={() => setConfirmDeactivateInvite(invite.id)}
                              disabled={loading}
                            >
                              {t('groups.deactivateInvite')}
                            </button>
                          )
                        ) : (
                          <span className="text-xs text-neutral-400">{t('groups.inviteInactive')}</span>
                        )}
                      </div>
                    </div>
                  )})}
                  {invites.length === 0 && <p className="text-sm text-neutral-500">{t('groups.noInvites')}</p>}
                </div>
              </div>
            </>
          ) : (
            <div className="card p-4 text-neutral-500">{t('groups.noGroupSelected')}</div>
          )}
        </div>
      </div>
    </div>
  );
}

