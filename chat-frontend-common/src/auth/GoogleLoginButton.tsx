import { useTranslation } from 'react-i18next';
import { GoogleLogin, CredentialResponse } from '@react-oauth/google';
import { AlertCircle } from 'lucide-react';
import { useState } from 'react';

interface GoogleLoginButtonProps {
  onCredential: (credential: string) => void;
  disabled?: boolean;
}

export default function GoogleLoginButton({ onCredential, disabled }: GoogleLoginButtonProps) {
  const { t } = useTranslation();
  const [error, setError] = useState('');

  const handleSuccess = (response: CredentialResponse) => {
    setError('');
    if (response.credential) {
      onCredential(response.credential);
    } else {
      setError(t('login.google.noCredential'));
    }
  };

  const handleError = () => {
    setError(t('login.google.error'));
  };

  return (
    <div className="space-y-3">
      {error && (
        <div className="flex items-start gap-3 p-3 bg-red-50/50 text-error rounded-xl text-sm border border-red-100">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      <div className="flex justify-center" style={{ pointerEvents: disabled ? 'none' : 'auto', opacity: disabled ? 0.5 : 1 }}>
        <GoogleLogin
          onSuccess={handleSuccess}
          onError={handleError}
          size="large"
          width="300"
          text="signin_with"
          shape="rectangular"
          theme="outline"
        />
      </div>
    </div>
  );
}
