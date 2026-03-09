import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Heart, ArrowLeft } from 'lucide-react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import LanguageSelector from '../components/LanguageSelector';
import OtpLoginForm from './OtpLoginForm';
import GoogleLoginButton from './GoogleLoginButton';
import type { AuthenticatedUser } from '@mentalhelpglobal/chat-types';
import { getSurface, getSurfaceEntry } from '../routes/experienceRoutes';
import { useAuthStore } from '../stores/authStore';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const {
    googleLogin,
    googleClientId,
    googleOAuthAvailable,
    otpLoginDisabledWorkbench,
    loadGoogleConfig,
    isLoading
  } = useAuthStore();

  const inviteCode = new URLSearchParams(location.search).get('invite');
  const surface = getSurface();
  const showOtp = !(surface === 'workbench' && otpLoginDisabledWorkbench);
  const showGoogle = googleOAuthAvailable && !!googleClientId;

  useEffect(() => {
    loadGoogleConfig();
  }, [loadGoogleConfig]);

  const handleSuccess = (user: AuthenticatedUser, isNewUser: boolean) => {
    console.log(isNewUser
      ? `New account created for ${user.email}`
      : `Welcome back, ${user.displayName}!`
    );
    navigate(getSurfaceEntry());
  };

  const handleGoogleCredential = async (credential: string) => {
    const result = await googleLogin(credential, surface, inviteCode || undefined);
    if (result.pendingApproval) {
      navigate('/pending-approval');
      return;
    }
    if (result.success && result.user) {
      handleSuccess(result.user, result.isNewUser);
    }
  };

  const googleSection = showGoogle && googleClientId ? (
    <GoogleOAuthProvider clientId={googleClientId}>
      <GoogleLoginButton onCredential={handleGoogleCredential} disabled={isLoading} />
    </GoogleOAuthProvider>
  ) : null;

  const divider = showGoogle && showOtp ? (
    <div className="flex items-center gap-4 my-6">
      <div className="flex-1 h-px bg-neutral-200" />
      <span className="text-sm text-neutral-400">{t('login.divider')}</span>
      <div className="flex-1 h-px bg-neutral-200" />
    </div>
  ) : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-primary-50 to-secondary-50 flex flex-col">
      <div className="absolute top-4 right-4 z-20">
        <LanguageSelector variant="buttons" />
      </div>

      {surface !== 'workbench' && (
        <div className="p-4">
          <button
            onClick={() => navigate('/')}
            className="btn-ghost"
            aria-label={t('login.back')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" aria-hidden="true" />
            {t('login.back')}
          </button>
        </div>
      )}

      <main className="flex-1 flex items-center justify-center px-4 pb-8" role="main">
        <div className="max-w-md w-full" style={{ minWidth: 'min(100%, 320px)' }}>
          <div className="text-center mb-6 sm:mb-8">
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-primary-400 to-primary-500 rounded-2xl flex items-center justify-center mx-auto mb-3 sm:mb-4 shadow-soft-lg">
              <Heart className="w-7 h-7 sm:w-8 sm:h-8 text-white" aria-hidden="true" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-neutral-800">{t('login.title')}</h1>
            <p className="text-neutral-500 mt-1 text-sm sm:text-base">{t('login.subtitle')}</p>
          </div>

          <div className="card p-6 sm:p-8" role="form" aria-label={t('login.title')}>
            {googleSection}
            {divider}
            {showOtp && (
              <OtpLoginForm onSuccess={handleSuccess} initialInviteCode={inviteCode} surface={surface} />
            )}
            {!showOtp && !showGoogle && (
              <p className="text-center text-neutral-500" role="alert">{t('login.noMethodsAvailable')}</p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
