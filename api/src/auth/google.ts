// Google OAuth 2.0 server-side flow.
//
// Sequence:
//   1. Frontend → /api/auth/google                       (302 to Google with state cookie)
//   2. Google → /api/auth/google/callback?code&state     (code exchange + id_token verify)
//   3. We upsert the user, sign our own session JWT, set an HTTP-only cookie,
//      then redirect back to the SPA.
//
// We don't use passport — it's overkill for a single provider. Hand-rolled
// in 100 lines, easy to audit.

import { createRemoteJWKSet, jwtVerify } from 'jose';
import { config } from '../config.js';

const REDIRECT_PATH = '/api/auth/google/callback';
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';

const jwks = createRemoteJWKSet(new URL(GOOGLE_JWKS_URL));

export function getRedirectUri(): string {
  return `${config.publicBaseUrl}${REDIRECT_PATH}`;
}

export function buildAuthUrl(state: string, returnTo: string): string {
  // We tuck `returnTo` into the state cookie below; here we just send the
  // state nonce. Google will echo it back in the callback so we can match.
  void returnTo;
  const params = new URLSearchParams({
    client_id: config.googleClientId,
    redirect_uri: getRedirectUri(),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'online',
    prompt: 'select_account',
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  id_token: string;
  scope: string;
  token_type: 'Bearer';
}

export interface GoogleProfile {
  sub: string;
  email: string;
  name: string;
  picture?: string;
  email_verified: boolean;
}

export async function exchangeCodeForProfile(code: string): Promise<GoogleProfile> {
  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.googleClientId,
      client_secret: config.googleClientSecret,
      redirect_uri: getRedirectUri(),
      grant_type: 'authorization_code',
    }),
  });
  if (!tokenRes.ok) {
    const body = await tokenRes.text();
    throw new Error(`Google token exchange failed (${tokenRes.status}): ${body.slice(0, 200)}`);
  }
  const tokens = (await tokenRes.json()) as TokenResponse;

  // Verify the id_token signature against Google's public keys. Critical:
  // without this, anyone could craft an arbitrary id_token. jose handles
  // signature + iss + aud checks for us.
  const { payload } = await jwtVerify(tokens.id_token, jwks, {
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
    audience: config.googleClientId,
  });

  if (typeof payload.sub !== 'string' || typeof payload.email !== 'string') {
    throw new Error('id_token missing sub or email');
  }
  if (payload.email_verified !== true) {
    throw new Error('Google email not verified');
  }

  return {
    sub: payload.sub,
    email: payload.email,
    name: typeof payload.name === 'string' ? payload.name : payload.email,
    picture: typeof payload.picture === 'string' ? payload.picture : undefined,
    email_verified: true,
  };
}
