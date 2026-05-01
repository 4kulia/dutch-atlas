import { Router } from 'express';
import { ulid } from 'ulid';
import { randomBytes } from 'node:crypto';
import { buildAuthUrl, exchangeCodeForProfile } from '../auth/google.js';
import { signSession } from '../auth/jwt.js';
import { SESSION_COOKIE_NAME, requireAuth, type AuthedRequest } from '../auth/middleware.js';
import { config } from '../config.js';
import { query } from '../db.js';

export const authRouter: Router = Router();

const STATE_COOKIE = 'nl_oauth_state';
const RETURN_COOKIE = 'nl_oauth_return';
const TEN_MIN = 10 * 60 * 1000;
const THIRTY_DAYS_S = 30 * 24 * 60 * 60;

function isProd(): boolean {
  return config.nodeEnv === 'production';
}

function setStateCookies(res: import('express').Response, state: string, returnTo: string) {
  const cookieFlags = `; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.floor(TEN_MIN / 1000)}${
    isProd() ? '; Secure' : ''
  }`;
  res.append('Set-Cookie', `${STATE_COOKIE}=${encodeURIComponent(state)}${cookieFlags}`);
  res.append('Set-Cookie', `${RETURN_COOKIE}=${encodeURIComponent(returnTo)}${cookieFlags}`);
}

function clearStateCookies(res: import('express').Response) {
  for (const name of [STATE_COOKIE, RETURN_COOKIE]) {
    res.append('Set-Cookie', `${name}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${isProd() ? '; Secure' : ''}`);
  }
}

function setSessionCookie(res: import('express').Response, token: string) {
  res.append(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${THIRTY_DAYS_S}${
      isProd() ? '; Secure' : ''
    }`,
  );
}

function clearSessionCookie(res: import('express').Response) {
  res.append(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${isProd() ? '; Secure' : ''}`,
  );
}

function readStateCookies(req: import('express').Request): { state?: string; returnTo?: string } {
  const cookieHeader = req.headers.cookie ?? '';
  const out: { state?: string; returnTo?: string } = {};
  for (const piece of cookieHeader.split(';')) {
    const eq = piece.indexOf('=');
    if (eq <= 0) continue;
    const name = piece.slice(0, eq).trim();
    const value = decodeURIComponent(piece.slice(eq + 1).trim());
    if (name === STATE_COOKIE) out.state = value;
    if (name === RETURN_COOKIE) out.returnTo = value;
  }
  return out;
}

// Step 1 — kick off Google OAuth.
authRouter.get('/google', (req, res) => {
  const state = randomBytes(24).toString('base64url');
  const returnTo = typeof req.query.return_to === 'string' ? req.query.return_to : '/';
  setStateCookies(res, state, returnTo);
  res.redirect(buildAuthUrl(state, returnTo));
});

// Step 2 — Google sends the code back to us.
authRouter.get('/google/callback', async (req, res) => {
  const code = typeof req.query.code === 'string' ? req.query.code : null;
  const incomingState = typeof req.query.state === 'string' ? req.query.state : null;
  const { state: cookieState, returnTo } = readStateCookies(req);
  clearStateCookies(res);

  if (!code || !incomingState || incomingState !== cookieState) {
    res.status(400).send('OAuth state mismatch — please try signing in again.');
    return;
  }

  let profile;
  try {
    profile = await exchangeCodeForProfile(code);
  } catch (err) {
    console.error('[auth] google exchange failed', err);
    res.status(502).send('Google sign-in failed. Please try again.');
    return;
  }

  // Upsert by google_sub. Email could change in theory (Google account
  // settings), `sub` is permanent.
  const userId = ulid();
  const upsert = await query<{ id: string }>(
    `INSERT INTO users (id, email, name, avatar_url, google_sub)
       VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (google_sub) DO UPDATE
       SET email = EXCLUDED.email,
           name = EXCLUDED.name,
           avatar_url = EXCLUDED.avatar_url,
           updated_at = now()
     RETURNING id`,
    [userId, profile.email, profile.name, profile.picture ?? null, profile.sub],
  );
  const realId = upsert.rows[0]!.id;

  const token = await signSession(realId, profile.email);
  setSessionCookie(res, token);

  // Send the user back where they started (or "/" if missing).
  const target = returnTo && returnTo.startsWith('/') ? returnTo : '/';
  res.redirect(target);
});

// Quick "who am I" probe — used by the SPA on mount to populate auth state.
authRouter.get('/me', requireAuth, async (req: AuthedRequest, res) => {
  const r = await query<{ id: string; email: string; name: string; avatar_url: string | null }>(
    'SELECT id, email, name, avatar_url FROM users WHERE id = $1',
    [req.user!.id],
  );
  const row = r.rows[0];
  if (!row) {
    res.status(401).json({ error: 'user_not_found' });
    return;
  }
  res.json({
    user: {
      id: row.id,
      email: row.email,
      name: row.name,
      avatarUrl: row.avatar_url,
    },
  });
});

authRouter.post('/logout', (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});
