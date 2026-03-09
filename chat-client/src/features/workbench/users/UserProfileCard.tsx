import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../../stores/authStore';
import { useWorkbenchStore } from '../../../stores/workbenchStore';
import { UserRole, Permission } from '../../../types';
import { maskEmail, maskName } from '../../../utils/piiMasking';
import { 
  ArrowLeft, User, Mail, Calendar, Clock, MessageSquare,
  Ban, UserCheck, Shield, Download, Trash2, AlertTriangle
} from 'lucide-react';

export default function UserProfileCard() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user: currentUser } = useAuthStore();
  const { 
    selectedUser, 
    selectUser, 
    piiMasked,
    blockUser, 
    unblockUser, 
    changeUserRole,
    exportUserData,
    eraseUserData 
  } = useWorkbenchStore();

  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [showEraseConfirm, setShowEraseConfirm] = useState(false);
  const [eraseReason, setEraseReason] = useState('');
  const [exportJobId, setExportJobId] = useState<string | null>(null);

  useEffect(() => {
    if (userId) {
      selectUser(userId);
    }
    return () => {
      // Fire-and-forget cleanup - don't await since cleanup must be sync
      selectUser(null);
    };
  }, [userId, selectUser]);

  if (!selectedUser) {
    return (
      <div className="text-center py-12">
        <p className="text-neutral-500">{t('common.notFound')}</p>
        <button onClick={() => navigate('/workbench/users')} className="btn-primary mt-4">
          {t('userProfile.backToList')}
        </button>
      </div>
    );
  }

  const displayName = piiMasked ? maskName(selectedUser.displayName) : selectedUser.displayName;
  const displayEmail = piiMasked ? maskEmail(selectedUser.email) : selectedUser.email;
  const isOwner = currentUser?.permissions.includes(Permission.WORKBENCH_PRIVACY);
  const canChangeRole = currentUser?.role === UserRole.OWNER;

  const handleExport = async () => {
    const result = await exportUserData(selectedUser.id);
    setExportJobId(result.jobId);
  };

  const handleErase = async () => {
    if (!eraseReason.trim()) return;
    await eraseUserData(selectedUser.id, eraseReason);
    setShowEraseConfirm(false);
    setEraseReason('');
  };

  const getStatusColor = () => {
    switch (selectedUser.status) {
      case 'active': return 'text-secondary-600';
      case 'blocked': return 'text-error';
      case 'pending': return 'text-amber-600';
      case 'approval': return 'text-amber-600';
      case 'disapproved': return 'text-error';
      case 'anonymized': return 'text-neutral-500';
      default: return 'text-neutral-500';
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Back button */}
      <button
        onClick={() => navigate('/workbench/users')}
        className="btn-ghost mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        {t('userProfile.backToList')}
      </button>

      {/* Profile header */}
      <div className="card p-6 mb-6">
        <div className="flex items-start gap-6">
          {/* Avatar */}
          <div className="w-20 h-20 bg-primary-100 rounded-2xl flex items-center justify-center flex-shrink-0">
            <User className="w-10 h-10 text-primary-600" />
          </div>

          {/* Info */}
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-neutral-800">{displayName}</h1>
            <p className="text-neutral-500 flex items-center gap-2 mt-1">
              <Mail className="w-4 h-4" />
              {displayEmail}
            </p>
            <div className="flex items-center gap-3 mt-3">
              <span className="badge badge-info">
                {t(`roles.${selectedUser.role}`)}
              </span>
              <span className={`flex items-center gap-1 text-sm font-medium ${getStatusColor()}`}>
                <span className={`w-2 h-2 rounded-full ${
                  selectedUser.status === 'active' ? 'bg-secondary-500' :
                  selectedUser.status === 'blocked' ? 'bg-error' :
                  selectedUser.status === 'pending' ? 'bg-amber-500' :
                  'bg-neutral-400'
                }`} />
                {t(`users.filters.${selectedUser.status}`)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Account Information */}
      <div className="card p-6 mb-6">
        <h2 className="text-lg font-semibold text-neutral-900 mb-4">{t('userProfile.accountInfo')}</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-3 p-3 bg-neutral-50 rounded-lg">
            <Calendar className="w-5 h-5 text-neutral-400" />
            <div>
              <p className="text-xs text-neutral-500">{t('userProfile.created')}</p>
              <p className="text-sm font-medium text-neutral-700">
                {new Date(selectedUser.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-neutral-50 rounded-lg">
            <Clock className="w-5 h-5 text-neutral-400" />
            <div>
              <p className="text-xs text-neutral-500">{t('userProfile.lastLogin')}</p>
              <p className="text-sm font-medium text-neutral-700">
                {selectedUser.lastLoginAt 
                  ? new Date(selectedUser.lastLoginAt).toLocaleDateString() 
                  : t('users.table.never')
                }
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-neutral-50 rounded-lg">
            <MessageSquare className="w-5 h-5 text-neutral-400" />
            <div>
              <p className="text-xs text-neutral-500">{t('userProfile.totalSessions')}</p>
              <p className="text-sm font-medium text-neutral-700">{selectedUser.sessionCount}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-neutral-50 rounded-lg">
            <Shield className="w-5 h-5 text-neutral-400" />
            <div>
              <p className="text-xs text-neutral-500">{t('userProfile.userId')}</p>
              <p className="text-sm font-medium text-neutral-700 font-mono">
                {piiMasked ? '****' : selectedUser.id}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Administrative Actions */}
      <div className="card p-6 mb-6">
        <h2 className="text-lg font-semibold text-neutral-900 mb-4">{t('userProfile.adminActions')}</h2>
        <div className="flex flex-wrap gap-3">
          {/* Block/Unblock */}
          {selectedUser.status === 'blocked' ? (
            <button 
              onClick={() => unblockUser(selectedUser.id)}
              className="btn bg-secondary-500 text-white hover:bg-secondary-600"
            >
              <UserCheck className="w-4 h-4 mr-2" />
              {t('userProfile.unblockUser')}
            </button>
          ) : selectedUser.status !== 'anonymized' && (
            <button 
              onClick={() => blockUser(selectedUser.id)}
              className="btn-danger"
            >
              <Ban className="w-4 h-4 mr-2" />
              {t('userProfile.blockUser')}
            </button>
          )}

          {/* Change Role (Owner only) */}
          {canChangeRole && selectedUser.status !== 'anonymized' && (
            <div className="relative">
              <button 
                onClick={() => setShowRoleMenu(!showRoleMenu)}
                className="btn-outline"
              >
                <User className="w-4 h-4 mr-2" />
                {t('userProfile.changeRole')}
              </button>
              
              {showRoleMenu && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setShowRoleMenu(false)} 
                  />
                  <div className="absolute top-full mt-2 left-0 bg-white rounded-lg shadow-lg border border-neutral-200 py-1 z-20 min-w-[160px]">
                    {Object.values(UserRole).map(role => (
                      <button
                        key={role}
                        onClick={() => {
                          changeUserRole(selectedUser.id, role);
                          setShowRoleMenu(false);
                        }}
                        className={`w-full px-4 py-2 text-left text-sm hover:bg-neutral-50 ${
                          selectedUser.role === role ? 'bg-primary-50 text-primary-700' : 'text-neutral-700'
                        }`}
                      >
                        {t(`roles.${role}`)}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* GDPR Data Rights */}
      {isOwner && selectedUser.status !== 'anonymized' && (
        <div className="card p-6 border-amber-200 bg-amber-50/50">
          <h2 className="text-lg font-semibold text-neutral-900 mb-2">{t('userProfile.gdpr.title')}</h2>
          <p className="text-sm text-neutral-600 mb-4">
            {t('userProfile.gdpr.description')}
          </p>
          
          <div className="flex flex-wrap gap-3">
            {/* Download Archive */}
            <button 
              onClick={handleExport}
              className="btn-outline"
            >
              <Download className="w-4 h-4 mr-2" />
              {t('userProfile.gdpr.downloadArchive')}
            </button>

            {/* Execute Erasure */}
            <button 
              onClick={() => setShowEraseConfirm(true)}
              className="btn bg-error/10 text-error hover:bg-error/20"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {t('userProfile.gdpr.executeErasure')}
            </button>
          </div>

          {exportJobId && (
            <div className="mt-4 p-3 bg-white rounded-lg border border-amber-200">
              <p className="text-sm text-neutral-600">
                {t('userProfile.gdpr.exportRequested')} <code className="bg-neutral-100 px-1 rounded">{exportJobId}</code>
              </p>
              <p className="text-xs text-neutral-500 mt-1">
                {t('userProfile.gdpr.exportReady')}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Anonymized user notice */}
      {selectedUser.status === 'anonymized' && (
        <div className="card p-6 bg-neutral-50 border-neutral-300">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-neutral-500 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-neutral-700">{t('userProfile.anonymized.title')}</h3>
              <p className="text-sm text-neutral-500 mt-1">
                {t('userProfile.anonymized.description')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Erasure Confirmation Modal */}
      {showEraseConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-error/10 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-error" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-neutral-900">{t('userProfile.erasure.confirmTitle')}</h2>
                <p className="text-sm text-neutral-500">{t('userProfile.erasure.cannotUndo')}</p>
              </div>
            </div>

            <div className="bg-error/5 border border-error/20 rounded-lg p-4 mb-4">
              <p className="text-sm text-error">
                {t('userProfile.erasure.warning')} <strong>{displayName}</strong>.
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                {t('userProfile.erasure.reason')}
              </label>
              <textarea
                value={eraseReason}
                onChange={(e) => setEraseReason(e.target.value)}
                placeholder={t('userProfile.erasure.reasonPlaceholder')}
                rows={3}
                className="input resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3">
              <button 
                onClick={() => setShowEraseConfirm(false)} 
                className="btn-outline"
              >
                {t('userProfile.erasure.cancel')}
              </button>
              <button
                onClick={handleErase}
                disabled={!eraseReason.trim()}
                className="btn-danger"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {t('userProfile.erasure.execute')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
