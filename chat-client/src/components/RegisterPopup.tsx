import { useTranslation } from 'react-i18next';
import { X, UserPlus } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useChatStore } from '@/stores/chatStore';
import OtpLoginForm from './OtpLoginForm';
import { AuthenticatedUser } from '../types';

interface RegisterPopupProps {
  onClose: () => void;
}

export default function RegisterPopup({ onClose }: RegisterPopupProps) {
  const { t } = useTranslation();
  const { upgradeFromGuest, resetOtpState } = useAuthStore();
  const { bindSessionToUser } = useChatStore();

  // Reset OTP state when closing the popup
  const handleClose = () => {
    resetOtpState();
    onClose();
  };

  const handleSuccess = (user: AuthenticatedUser, isNewUser: boolean) => {
    // Bind the current guest session to the user
    bindSessionToUser(user.id);
    
    // Upgrade from guest to authenticated user
    upgradeFromGuest(user);
    
    // Close the popup (no need to reset OTP state here as we succeeded)
    onClose();
    
    // Show a brief notification (optional - you could use a toast here)
    console.log(isNewUser 
      ? `🎉 Welcome! Account created for ${user.email}` 
      : `✅ Welcome back, ${user.displayName}!`
    );
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
                {t('chat.registerPopup.title')}
              </h2>
              <p className="text-sm text-neutral-500">
                {t('chat.registerPopup.subtitle')}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
            aria-label={t('common.close')}
          >
            <X className="w-5 h-5 text-neutral-500" />
          </button>
        </div>
        
        {/* Form */}
        <div className="p-6">
          <OtpLoginForm 
            onSuccess={handleSuccess}
            onCancel={handleClose}
            compact
          />
          
          {/* Info text */}
          <p className="text-xs text-neutral-500 text-center mt-4">
            {t('chat.registerPopup.chatPreserved')}
          </p>
        </div>
      </div>
    </div>
  );
}

