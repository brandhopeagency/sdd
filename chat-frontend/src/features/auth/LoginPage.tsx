import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Heart, ArrowLeft, AlertCircle } from 'lucide-react';
import { GoogleOAuthProvider, GoogleLogin, CredentialResponse } from '@react-oauth/google';
import LanguageSelector from '../../components/LanguageSelector';
import OtpLoginForm from '../../components/OtpLoginForm';
import { AuthenticatedUser } from '../../types';
import { getSurfaceEntry } from '../../routes/experienceRoutes';
import { useAuthStore } from '@/stores/authStore';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const {
    googleOAuthAvailable,
    googleClientId,
    loadGoogleConfig,
    googleLogin
  } = useAuthStore();
  const [googleError, setGoogleError] = useState<string | null>(null);

  const inviteCode = new URLSearchParams(location.search).get('invite');

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

  const handleGoogleSuccess = async (response: CredentialResponse) => {
    setGoogleError(null);
    if (!response.credential) {
      setGoogleError(t('login.google.noCredential'));
      return;
    }
    const result = await googleLogin(response.credential, 'chat', inviteCode || undefined);
    if (result.success && result.user) {
      handleSuccess(result.user, result.isNewUser);
    } else if (result.pendingApproval) {
      navigate('/pending');
    }
  };

  const showGoogle = googleOAuthAvailable && !!googleClientId;

  const googleSection = showGoogle ? (
    <div className="flex flex-col items-center gap-3 mb-2">
      <GoogleOAuthProvider clientId={googleClientId!}>
        <GoogleLogin
          onSuccess={handleGoogleSuccess}
          onError={() => setGoogleError(t('login.google.error'))}
          size="large"
          width="300"
          theme="outline"
          text="signin_with"
          shape="rectangular"
        />
      </GoogleOAuthProvider>
      {googleError && (
        <div className="flex items-start gap-2 text-sm text-red-600">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{googleError}</span>
        </div>
      )}
    </div>
  ) : null;

  const divider = showGoogle ? (
    <div className="flex items-center gap-3 my-4">
      <div className="flex-1 h-px bg-neutral-200" />
      <span className="text-sm text-neutral-400">{t('login.divider')}</span>
      <div className="flex-1 h-px bg-neutral-200" />
    </div>
  ) : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-primary-50 to-secondary-50 flex flex-col">
      <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20">
        <LanguageSelector variant="buttons" />
      </div>

      <div className="p-3 sm:p-4">
        <button
          onClick={() => navigate('/')}
          className="btn-ghost"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('login.back')}
        </button>
      </div>

      <main className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-6 sm:mb-8">
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-primary-400 to-primary-500 rounded-2xl flex items-center justify-center mx-auto mb-3 sm:mb-4 shadow-soft-lg">
              <Heart className="w-7 h-7 sm:w-8 sm:h-8 text-white" aria-hidden="true" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-neutral-800">{t('login.title')}</h1>
            <p className="text-neutral-500 mt-1 text-sm sm:text-base">{t('login.subtitle')}</p>
          </div>

          <div className="card p-5 sm:p-8" role="form" aria-label={t('login.title')}>
            {googleSection}
            {divider}
            <OtpLoginForm onSuccess={handleSuccess} initialInviteCode={inviteCode} />
          </div>
        </div>
      </main>
    </div>
  );
}
