import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/authStore';

export default function PendingApprovalPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, logout } = useAuthStore();

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-primary-50 to-secondary-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="card p-8 text-center">
          <h1 className="text-2xl font-bold text-neutral-800">{t('pending.title')}</h1>
          <p className="text-neutral-500 mt-2">{t('pending.subtitle')}</p>

          {user?.email && (
            <div className="mt-4 text-sm text-neutral-600">
              {t('pending.signedInAs', { email: user.email })}
            </div>
          )}

          <div className="mt-6 flex flex-col gap-3">
            <button
              className="btn-primary"
              onClick={() => {
                navigate('/');
              }}
            >
              {t('pending.backToHome')}
            </button>
            <button
              className="btn-ghost text-error"
              onClick={() => {
                logout();
              }}
            >
              {t('common.signOut')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

