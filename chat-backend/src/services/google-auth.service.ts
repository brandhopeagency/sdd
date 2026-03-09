import { OAuth2Client, TokenPayload } from 'google-auth-library';

let _client: OAuth2Client | null = null;

function getClient(): OAuth2Client | null {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) return null;
  if (!_client) {
    _client = new OAuth2Client(clientId);
  }
  return _client;
}

export function isGoogleOAuthConfigured(): boolean {
  return !!process.env.GOOGLE_OAUTH_CLIENT_ID;
}

export function getGoogleClientId(): string | null {
  return process.env.GOOGLE_OAUTH_CLIENT_ID || null;
}

export async function verifyGoogleIdToken(
  credential: string
): Promise<TokenPayload> {
  const client = getClient();
  if (!client) {
    throw new Error('Google OAuth is not configured');
  }

  const ticket = await client.verifyIdToken({
    idToken: credential,
    audience: process.env.GOOGLE_OAUTH_CLIENT_ID!,
  });

  const payload = ticket.getPayload();
  if (!payload) {
    throw new Error('Invalid Google ID token: no payload');
  }

  if (!payload.email || !payload.email_verified) {
    throw new Error('Google account email not verified');
  }

  return payload;
}
