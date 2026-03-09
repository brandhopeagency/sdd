import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Heart, ArrowLeft } from 'lucide-react';
import LanguageSelector from '../../components/LanguageSelector';
import OtpLoginForm from '../../components/OtpLoginForm';
import { AuthenticatedUser } from '../../types';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  const inviteCode = new URLSearchParams(location.search).get('invite');

  const handleSuccess = (user: AuthenticatedUser, isNewUser: boolean) => {
    console.log(isNewUser 
      ? `🎉 New account created for ${user.email}` 
      : `✅ Welcome back, ${user.displayName}!`
    );
    navigate('/chat');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-primary-50 to-secondary-50 flex flex-col">
      {/* Language selector */}
      <div className="absolute top-4 right-4 z-20">
        <LanguageSelector variant="buttons" />
      </div>

      {/* Back button */}
      <div className="p-4">
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
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-primary-400 to-primary-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-soft-lg">
              <Heart className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-neutral-800">{t('login.title')}</h1>
            <p className="text-neutral-500 mt-1">{t('login.subtitle')}</p>
          </div>

          {/* Login Form */}
          <div className="card p-8">
            <OtpLoginForm onSuccess={handleSuccess} initialInviteCode={inviteCode} />
          </div>
        </div>
      </main>
    </div>
  );
}
