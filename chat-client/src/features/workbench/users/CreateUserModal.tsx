import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, UserPlus, AlertCircle } from 'lucide-react';
import { usersApi } from '../../../services/api';
import { UserRole } from '../../../types';
import { useAuthStore } from '../../../stores/authStore';

interface CreateUserModalProps {
  onSuccess: () => void;
  onClose: () => void;
}

export default function CreateUserModal({ onSuccess, onClose }: CreateUserModalProps) {
  const { t } = useTranslation();
  const { user: currentUser } = useAuthStore();
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.USER);
  const [status, setStatus] = useState<
    'active' | 'blocked' | 'pending' | 'approval' | 'disapproved' | 'anonymized'
  >('active');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOwner = currentUser?.role === UserRole.OWNER;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!email.trim()) {
      setError(t('users.createUser.error.emailRequired'));
      return;
    }

    if (!displayName.trim()) {
      setError(t('users.createUser.error.displayNameRequired'));
      return;
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError(t('users.createUser.error.invalidEmail'));
      return;
    }

    setLoading(true);

    try {
      const userData = {
        email: email.trim(),
        displayName: displayName.trim(),
        role: isOwner ? role : undefined, // Only send role if owner
        status
      };
      
      let response = await usersApi.create(userData);
      
      // Check if we need to retry after token refresh
      if (!response.success && response.error) {
        const refreshed = await useAuthStore.getState().handleApiError(response.error);
        if (refreshed) {
          // Retry the API call with refreshed token
          response = await usersApi.create(userData);
        }
      }
      
      if (response.success) {
        // Reset form
        setEmail('');
        setDisplayName('');
        setRole(UserRole.USER);
        setStatus('active');
        
        // Close modal and refresh list
        onSuccess();
        onClose();
      } else {
        // Handle error
        if (response.error?.code === 'EMAIL_ALREADY_EXISTS') {
          setError(t('users.createUser.error.emailExists'));
        } else if (response.error?.code === 'INVALID_EMAIL_FORMAT') {
          setError(t('users.createUser.error.invalidEmail'));
        } else {
          setError(response.error?.message || t('users.createUser.error.generic'));
        }
      }
    } catch (err: any) {
      console.error('[CreateUserModal] Error creating user:', err);
      setError(t('users.createUser.error.generic'));
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    setError(null);
    setEmail('');
    setDisplayName('');
    setRole(UserRole.USER);
    setStatus('active');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h2 className="font-semibold text-neutral-800">
                {t('users.createUser.title')}
              </h2>
              <p className="text-sm text-neutral-500">
                {t('users.createUser.subtitle')}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={loading}
            className="p-2 hover:bg-neutral-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5 text-neutral-500" />
          </button>
        </div>
        
        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          {/* Error message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Email */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              {t('users.createUser.email')} <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('users.createUser.emailPlaceholder')}
              required
              disabled={loading}
              className="input w-full"
            />
          </div>

          {/* Display Name */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              {t('users.createUser.displayName')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={t('users.createUser.displayNamePlaceholder')}
              required
              disabled={loading}
              className="input w-full"
            />
          </div>

          {/* Role (only for owners) */}
          {isOwner && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                {t('users.createUser.role')}
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                disabled={loading}
                className="input w-full"
              >
                {Object.values(UserRole).map((r) => (
                  <option key={r} value={r}>
                    {t(`roles.${r}`)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Status */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              {t('users.createUser.status')}
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
              disabled={loading}
              className="input w-full"
            >
              <option value="active">{t('users.filters.active')}</option>
              <option value="blocked">{t('users.filters.blocked')}</option>
              <option value="pending">{t('users.filters.pending')}</option>
              <option value="approval">{t('users.filters.approval')}</option>
              <option value="disapproved">{t('users.filters.disapproved')}</option>
              <option value="anonymized">{t('users.filters.anonymized')}</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="btn-outline"
            >
              {t('users.createUser.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading || !email.trim() || !displayName.trim()}
              className="btn-primary"
            >
              {loading ? t('common.loading') : t('users.createUser.submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

