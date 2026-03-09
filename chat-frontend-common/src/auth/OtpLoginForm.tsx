import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../stores/authStore';
import { Mail, KeyRound, AlertCircle, ArrowLeft, Loader2, CheckCircle } from 'lucide-react';
import type { AuthenticatedUser } from '@mentalhelpglobal/chat-types';

interface OtpLoginFormProps {
  onSuccess: (user: AuthenticatedUser, isNewUser: boolean) => void;
  onCancel?: () => void;
  compact?: boolean;
  initialInviteCode?: string | null;
  surface?: 'chat' | 'workbench';
}

export default function OtpLoginForm({
  onSuccess,
  onCancel,
  compact = false,
  initialInviteCode = null,
  surface
}: OtpLoginFormProps) {
  const { t } = useTranslation();
  const {
    sendOtp,
    verifyOtp,
    resetOtpState,
    otpSent,
    pendingEmail,
    otpError,
    isLoading
  } = useAuthStore();

  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [invitationCode, setInvitationCode] = useState(initialInviteCode || '');
  const [localError, setLocalError] = useState('');

  // Reset OTP state when component unmounts
  useEffect(() => {
    return () => {
      resetOtpState();
    };
  }, [resetOtpState]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');

    if (!email.trim() || !email.includes('@')) {
      setLocalError(t('login.otp.invalidEmail'));
      return;
    }

    await sendOtp(email, surface);
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');

    if (!otp.trim() || otp.length !== 6) {
      setLocalError(t('login.otp.invalidCode'));
      return;
    }

    const result = await verifyOtp(pendingEmail!, otp, invitationCode.trim() || undefined);

    if (result.success && result.user) {
      onSuccess(result.user, result.isNewUser);
    }
  };

  const handleBack = () => {
    resetOtpState();
    setOtp('');
    setLocalError('');
  };

  const error = localError || (otpError ? t(`login.otp.${otpError}`) : '');

  // Step 1: Email input
  if (!otpSent) {
    return (
      <form onSubmit={handleSendOtp} className="space-y-4">
        {error && (
          <div className="flex items-start gap-3 p-3 bg-red-50/50 text-error rounded-xl text-sm border border-red-100">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-neutral-600 mb-2">
            {t('login.otp.emailLabel')}
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input pl-10"
              placeholder={t('login.otp.emailPlaceholder')}
              required
              autoFocus
            />
          </div>
          <p className="text-xs text-neutral-500 mt-2">
            {t('login.otp.emailHint')}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-600 mb-2">
            {t('login.otp.invitationLabel')}
          </label>
          <input
            type="text"
            value={invitationCode}
            onChange={(e) => setInvitationCode(e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())}
            className="input"
            placeholder={t('login.otp.invitationPlaceholder')}
          />
          <p className="text-xs text-neutral-500 mt-2">
            {t('login.otp.invitationHint')}
          </p>
        </div>

        <div className={compact ? 'flex gap-2' : 'space-y-2'}>
          <button
            type="submit"
            disabled={isLoading}
            className={`btn-primary ${compact ? 'flex-1' : 'w-full'} py-3`}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t('login.otp.sending')}
              </>
            ) : (
              t('login.otp.sendCode')
            )}
          </button>

          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className={`btn-ghost ${compact ? '' : 'w-full'} py-3`}
            >
              {t('common.cancel')}
            </button>
          )}
        </div>
      </form>
    );
  }

  // Step 2: OTP verification
  return (
    <form onSubmit={handleVerifyOtp} className="space-y-4">
      {/* Success message */}
      <div className="flex items-start gap-3 p-3 bg-green-50/50 text-green-700 rounded-xl text-sm border border-green-100">
        <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-medium">{t('login.otp.codeSent')}</p>
          <p className="text-green-600">{pendingEmail}</p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 p-3 bg-red-50/50 text-error rounded-xl text-sm border border-red-100">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-neutral-600 mb-2">
          {t('login.otp.codeLabel')}
        </label>
        <div className="relative">
          <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
          <input
            type="text"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="input pl-10 text-center text-xl tracking-[0.5em] font-mono"
            placeholder="000000"
            maxLength={6}
            required
            autoFocus
          />
        </div>
        <p className="text-xs text-neutral-500 mt-2">
          {t('login.otp.codeHint')}
        </p>
      </div>

      <div className={compact ? 'flex gap-2' : 'space-y-2'}>
        <button
          type="submit"
          disabled={isLoading || otp.length !== 6}
          className={`btn-primary ${compact ? 'flex-1' : 'w-full'} py-3`}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {t('login.otp.verifying')}
            </>
          ) : (
            t('login.otp.verify')
          )}
        </button>

        <button
          type="button"
          onClick={handleBack}
          className={`btn-ghost ${compact ? '' : 'w-full'} py-3`}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('login.otp.changeEmail')}
        </button>
      </div>
    </form>
  );
}
