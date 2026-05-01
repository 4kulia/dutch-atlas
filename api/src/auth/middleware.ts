import type { Request, Response, NextFunction } from 'express';
import { verifySession } from './jwt.js';

export interface AuthedRequest extends Request {
  user?: { id: string; email: string };
}

const SESSION_COOKIE = 'nl_session';

function readToken(req: Request): string | null {
  // Primary: HTTP-only cookie set by /api/auth/google/callback. Fallback:
  // Authorization: Bearer <token> for clients that prefer header-based
  // delivery (mobile webview, integration tests).
  const cookieHeader = req.headers.cookie ?? '';
  for (const piece of cookieHeader.split(';')) {
    const eq = piece.indexOf('=');
    if (eq <= 0) continue;
    const name = piece.slice(0, eq).trim();
    if (name === SESSION_COOKIE) return decodeURIComponent(piece.slice(eq + 1).trim());
  }
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) return auth.slice('Bearer '.length).trim();
  return null;
}

// Hard guard — 401 if no valid session.
export async function requireAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = readToken(req);
  if (!token) {
    res.status(401).json({ error: 'unauthenticated' });
    return;
  }
  const claims = await verifySession(token);
  if (!claims) {
    res.status(401).json({ error: 'invalid_or_expired_session' });
    return;
  }
  req.user = { id: claims.sub, email: claims.email };
  next();
}

// Soft variant — populates req.user if the session is valid, otherwise
// continues without it. Used by endpoints that have both anonymous and
// signed-in behaviour (e.g. attractions list which shows public + author's drafts).
export async function maybeAuth(
  req: AuthedRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const token = readToken(req);
  if (token) {
    const claims = await verifySession(token);
    if (claims) req.user = { id: claims.sub, email: claims.email };
  }
  next();
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;
