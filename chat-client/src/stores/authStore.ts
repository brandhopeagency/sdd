import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AuthenticatedUser, Permission } from '@/types';
import { authApi, settingsApi, setAccessToken, clearTokens, getAccessToken } from '@/services/api';

interface AuthState {
  user: AuthenticatedUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isGuest: boolean;
  guestId: string | null; // In-memory only, NOT persisted
  guestModeEnabled: boolean;
  approvalCooloffDays: number | null;
  activeGroupId: string | null;
  
  // OTP flow state
  otpSent: boolean;
  pendingEmail: string | null;
  otpError: string | null;
  
  // Actions
  logout: () => void;
  
  // OTP actions
  sendOtp: (email: string) => Promise<boolean>;
  verifyOtp: (
    email: string,
    code: string,
    invitationCode?: string
  ) => Promise<{ success: boolean; isNewUser: boolean; user?: AuthenticatedUser }>;
  resetOtpState: () => void;
  
  // Guest actions
  enterAsGuest: () => void;
  upgradeFromGuest: (user: AuthenticatedUser) => void;
  setActiveGroupId: (groupId: string | null) => void;
  
  // Helper to get effective userId (real user ID or guest ID)
  getEffectiveUserId: () => string | null;
  
  // Session management
  initializeAuth: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
  handleApiError: (error: { code?: string; message?: string }) => Promise<boolean>;
  loadPublicSettings: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      isGuest: false,
      guestId: null, // In-memory only, NOT persisted
      guestModeEnabled: false,
      approvalCooloffDays: null,
      activeGroupId: null,
      otpSent: false,
      pendingEmail: null,
      otpError: null,
      
      logout: async () => {
        try {
          // Call logout API to invalidate refresh token
          await authApi.logout();
        } catch (error) {
          console.error('Logout error:', error);
        } finally {
          // Always clear local state
          clearTokens();
          set({ 
            user: null, 
            isAuthenticated: false, 
            isGuest: false,
            guestId: null, // Clear guest ID on logout
            activeGroupId: null,
            otpSent: false,
            pendingEmail: null,
            otpError: null
          });
        }
      },
      
      // Send OTP to email
      sendOtp: async (email: string) => {
        set({ isLoading: true, otpError: null });
        
        try {
          const response = await authApi.sendOtp(email);
          
          if (response.success) {
            // Log OTP code to browser console in development
            if (response.data?.devCode) {
              const timestamp = new Date().toISOString();
              console.log('\n╔══════════════════════════════════════════════════════════════╗');
              console.log('║                    📧 OTP CODE (Development)                 ║');
              console.log('╠══════════════════════════════════════════════════════════════╣');
              console.log(`║  Email:   ${email.padEnd(50)}║`);
              console.log(`║  Code:    ${response.data.devCode.padEnd(50)}║`);
              console.log(`║  Expires: 5 minutes`.padEnd(62) + '║');
              console.log(`║  Time:    ${timestamp.padEnd(50)}║`);
              console.log('╚══════════════════════════════════════════════════════════════╝\n');
            }
            
            set({ 
              isLoading: false, 
              otpSent: true, 
              pendingEmail: email.toLowerCase().trim()
            });
            return true;
          } else {
            set({ 
              isLoading: false, 
              otpError: response.error?.code || 'send_failed'
            });
            return false;
          }
        } catch (error) {
          console.error('Error sending OTP:', error);
          set({ 
            isLoading: false, 
            otpError: 'send_failed'
          });
          return false;
        }
      },
      
      // Verify OTP and authenticate
      verifyOtp: async (email: string, code: string, invitationCode?: string) => {
        set({ isLoading: true, otpError: null });
        
        try {
          const response = await authApi.verifyOtp(email, code, invitationCode);
          
          if (response.success && response.data) {
            // Store access token
            setAccessToken(response.data.accessToken);

            const memberships = response.data.user.memberships || [];
            const defaultGroupId = memberships[0]?.groupId || null;
            
            set({ 
              user: response.data.user, 
              isAuthenticated: true, 
              isLoading: false,
              isGuest: false,
              otpSent: false,
              pendingEmail: null,
              activeGroupId: defaultGroupId
            });
            
            return { success: true, isNewUser: response.data.isNewUser, user: response.data.user };
          } else {
            // Map error codes to user-friendly keys
            const errorCode = response.error?.code?.toLowerCase() || 'verification_failed';
            set({ isLoading: false, otpError: errorCode });
            return { success: false, isNewUser: false };
          }
        } catch (error) {
          console.error('Error verifying OTP:', error);
          set({ isLoading: false, otpError: 'verification_failed' });
          return { success: false, isNewUser: false };
        }
      },
      
      // Reset OTP flow state
      resetOtpState: () => {
        set({
          otpSent: false,
          pendingEmail: null,
          otpError: null
        });
      },
      
      // Enter as guest (anonymous user)
      enterAsGuest: () => {
        const state = get();
        if (state.guestModeEnabled === false) {
          console.warn('[Auth] Guest mode disabled');
          return;
        }
        // Generate ephemeral guest ID (in-memory only, not persisted)
        const guestId = `guest_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
        console.log('[Auth] Generated ephemeral guest ID:', guestId);
        
        set({
          user: null,
          isAuthenticated: true, // Allow access to chat
          isGuest: true,
          guestId: guestId,
          otpSent: false,
          pendingEmail: null
        });
      },
      
      // Upgrade from guest to authenticated user
      upgradeFromGuest: (authUser: AuthenticatedUser) => {
        console.log('[Auth] Upgrading from guest to authenticated user:', authUser.id);
        const memberships = authUser.memberships || [];
        const defaultGroupId = memberships[0]?.groupId || null;
        set({
          user: authUser,
          isAuthenticated: true,
          isGuest: false,
          guestId: null, // Clear guest ID on authentication
          activeGroupId: defaultGroupId
        });
      },

      setActiveGroupId: (groupId: string | null) => {
        set({ activeGroupId: groupId });
      },
      
      // Get effective userId (authenticated user ID or guest ID)
      getEffectiveUserId: () => {
        const state = get();
        
        // If authenticated with real user, return user ID
        if (state.user?.id) {
          return state.user.id;
        }
        
        // If guest, return or generate guest ID
        if (state.isGuest) {
          if (state.guestId) {
            return state.guestId;
          }
          // Generate guest ID if somehow missing (shouldn't happen normally)
          const newGuestId = `guest_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
          console.log('[Auth] Generated missing guest ID:', newGuestId);
          set({ guestId: newGuestId });
          return newGuestId;
        }
        
        // No user ID available
        return null;
      },
      
      // Initialize auth state on app load
      initializeAuth: async () => {
        const token = getAccessToken();
        
        if (!token) {
          // No token, user is not authenticated
          return;
        }
        
        set({ isLoading: true });
        
        try {
          // Try to get current user
          const response = await authApi.getMe();
          
          if (response.success && response.data) {
            const memberships = response.data.memberships || [];
            const defaultGroupId = memberships[0]?.groupId || null;
            set({
              user: response.data,
              isAuthenticated: true,
              isLoading: false,
              activeGroupId: defaultGroupId
            });
          } else {
            // Token is invalid, try to refresh
            const refreshed = await get().refreshSession();
            if (!refreshed) {
              // refreshSession() already calls logout() on failure, so just set loading to false
              set({ isLoading: false });
            }
          }
        } catch (error) {
          console.error('Error initializing auth:', error);
          clearTokens();
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false
          });
        }
      },

      loadPublicSettings: async () => {
        try {
          const response = await settingsApi.getPublic();
          if (response.success && response.data) {
            set({
              guestModeEnabled: response.data.guestModeEnabled,
              approvalCooloffDays: response.data.approvalCooloffDays
            });
          }
        } catch (error) {
          console.warn('[Auth] Failed to load public settings:', error);
        }
      },
      
      // Refresh the session
      refreshSession: async () => {
        try {
          const response = await authApi.refresh();
          
          if (response.success && response.data) {
            const memberships = response.data.user.memberships || [];
            const defaultGroupId = memberships[0]?.groupId || null;
            setAccessToken(response.data.accessToken);
            set({
              user: response.data.user,
              isAuthenticated: true,
              isLoading: false,
              activeGroupId: defaultGroupId
            });
            return true;
          }
          
          // If refresh failed with 401 or invalid token, logout user
          if (!response.success && response.error) {
            const errorCode = response.error.code;
            // Check for authentication-related errors
            if (
              errorCode === 'NO_REFRESH_TOKEN' ||
              errorCode === 'INVALID_REFRESH_TOKEN' ||
              errorCode === 'FORBIDDEN_ORIGIN' ||
              errorCode === 'UNAUTHORIZED'
            ) {
              console.warn('[Auth] Refresh token invalid, logging out user');
              // Logout user automatically
              get().logout();
              return false;
            }
          }
          
          return false;
        } catch (error) {
          console.error('Error refreshing session:', error);
          // On any error during refresh, logout user to be safe
          get().logout();
          return false;
        }
      },
      
      // Handle API errors, especially authentication errors
      handleApiError: async (error: { code?: string; message?: string }) => {
        // Check if it's an authentication-related error
        if (
          error.code === 'UNAUTHORIZED' ||
          error.code === 'INVALID_TOKEN' ||
          error.code === 'TOKEN_EXPIRED'
        ) {
          console.log('[Auth] Authentication error detected, attempting token refresh');
          const refreshed = await get().refreshSession();
          return refreshed; // Return true if refresh succeeded, false otherwise
        }
        return false; // Not an auth error, no refresh needed
      }
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ 
        user: state.user, 
        isAuthenticated: state.isAuthenticated,
        isGuest: state.isGuest
        // NOTE: guestId is intentionally NOT persisted - it's in-memory only
      })
    }
  )
);

// Selector hooks for common checks
export const useHasPermission = (permission: Permission): boolean => {
  const user = useAuthStore(state => state.user);
  return user?.permissions.includes(permission) ?? false;
};

export const useCanAccessWorkbench = (): boolean => {
  return useHasPermission(Permission.WORKBENCH_ACCESS);
};

export const useIsGuest = (): boolean => {
  return useAuthStore(state => state.isGuest);
};
