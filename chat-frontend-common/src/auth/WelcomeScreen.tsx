import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useEffect } from 'react';
import { useAuthStore, useIsGuest } from '../stores/authStore';
import { Heart, LogOut, MessageCircle, User, LayoutDashboard } from 'lucide-react';
import LanguageSelector from '../components/LanguageSelector';
import { getSurface, getSurfaceEntry } from '../routes/experienceRoutes';

export default function WelcomeScreen() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isAuthenticated, enterAsGuest, user, logout, guestModeEnabled, loadPublicSettings } = useAuthStore();
  const isGuest = useIsGuest();
  const signedInLabel = user?.displayName ?? user?.email;
  const surface = getSurface();

  useEffect(() => {
    void loadPublicSettings();
  }, [loadPublicSettings]);

  // Auto-redirect authenticated workbench users to the workbench dashboard
  useEffect(() => {
    if (surface === 'workbench' && isAuthenticated && !isGuest) {
      navigate(getSurfaceEntry(), { replace: true });
    }
  }, [surface, isAuthenticated, isGuest, navigate]);

  const handleStartChat = () => {
    if (isAuthenticated) {
      navigate(getSurfaceEntry());
    } else if (guestModeEnabled === false) {
      navigate('/login');
    } else {
      enterAsGuest();
      navigate(getSurfaceEntry());
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-primary-50 to-secondary-50 flex flex-col">
      {/* Decorative background - 2 soft blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary-200 rounded-full opacity-30 blur-3xl animate-breathe" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-secondary-200 rounded-full opacity-30 blur-3xl" />
      </div>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center px-4 relative z-10">
        <div className="max-w-lg w-full text-center">
          {/* Logo/Icon */}
          <div className="mb-8 flex justify-center">
            <div className="w-20 h-20 bg-gradient-to-br from-primary-400 to-primary-500 rounded-2xl flex items-center justify-center shadow-soft-lg">
              <Heart className="w-10 h-10 text-white" />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-4xl font-bold text-neutral-800 mb-4">
            {t('app.name')}
          </h1>
          <p className="text-neutral-500 mb-10 max-w-md mx-auto leading-relaxed">
            {t('app.tagline')}. {t('app.description')}
          </p>

          {/* Language selector - above CTA */}
          <div className="mb-6 flex justify-center">
            <LanguageSelector variant="buttons" />
          </div>

          {/* Logged-in status + Sign out */}
          {isAuthenticated && !isGuest && (
            <div className="mb-6 flex justify-center">
              <div className="inline-flex items-center gap-3 px-4 py-3 rounded-xl bg-white/70 backdrop-blur border border-neutral-200 shadow-soft">
                <div className="w-9 h-9 bg-primary-100 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-primary-600" />
                </div>
                {signedInLabel && (
                  <div className="text-left">
                    <p className="text-sm text-neutral-700">
                      {t('welcome.signedInAs', { name: signedInLabel })}
                    </p>
                  </div>
                )}
                <button
                  onClick={() => {
                    logout();
                  }}
                  className="btn-ghost text-error flex items-center gap-2"
                  title={t('common.signOut')}
                >
                  <LogOut className="w-4 h-4" />
                  {t('common.signOut')}
                </button>
              </div>
            </div>
          )}

          {/* CTA Button */}
          <button
            onClick={handleStartChat}
            className="btn-primary text-lg px-8 py-4 rounded-xl shadow-soft-lg hover:shadow-soft transform hover:-translate-y-0.5 transition-all duration-300"
          >
            {surface === 'workbench' ? (
              <LayoutDashboard className="w-5 h-5 mr-2" />
            ) : (
              <MessageCircle className="w-5 h-5 mr-2" />
            )}
            {guestModeEnabled === false && !isAuthenticated
              ? t('welcome.signInToStart')
              : surface === 'workbench'
                ? t('welcome.goToWorkbench', 'Open Workbench')
                : t('welcome.startConversation')}
          </button>

          <p className="mt-3 text-sm text-neutral-500">
            {t('welcome.privacyNote')}
          </p>

          {/* Secondary link - Login for existing users (also show for guests) */}
          {guestModeEnabled !== false && (!isAuthenticated || isGuest) && (
            <p className="mt-6 text-neutral-500">
              {t('welcome.alreadyHaveAccount')}{' '}
              <button
                onClick={() => navigate('/login')}
                className="text-primary-600 hover:text-primary-700 font-medium transition-colors"
              >
                {t('welcome.signIn')}
              </button>
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
