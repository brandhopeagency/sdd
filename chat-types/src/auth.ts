import type { AuthenticatedUser } from './entities';

export interface GoogleAuthRequest {
  credential: string;
  invitationCode?: string;
  surface: 'chat' | 'workbench';
}

export interface GoogleAuthResponse {
  accessToken: string;
  user: AuthenticatedUser;
}

export interface OtpSendRequest {
  email: string;
  surface?: 'chat' | 'workbench';
}

export interface PublicSettings {
  guestModeEnabled: boolean;
  approvalCooloffDays: number | null;
  otpLoginDisabledWorkbench: boolean;
  googleOAuthAvailable: boolean;
}

export interface AppSettings {
  guestModeEnabled: boolean;
  approvalCooloffDays: number;
  otpLoginDisabledWorkbench: boolean;
}
