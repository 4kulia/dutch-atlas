// Session JWT — signed by us, verified by us. No external dependencies once
// issued. The token only carries the user id; everything else is fetched
// from the database when needed.
//
// Lifetime is 30 days. There is no refresh — when the token expires, the
// frontend prompts another Google sign-in, which is one click for the user.
// Rotating JWT_SECRET invalidates all sessions instantly.

import { SignJWT, jwtVerify } from 'jose';
import { config } from '../config.js';

const SECRET = new TextEncoder().encode(config.jwtSecret);
const ISSUER = 'nl-attractions';
const TOKEN_TTL = '30d';

export interface SessionClaims {
  sub: string;          // user id
  email: string;
}

export async function signSession(userId: string, email: string): Promise<string> {
  return await new SignJWT({ email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setExpirationTime(TOKEN_TTL)
    .sign(SECRET);
}

export async function verifySession(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET, { issuer: ISSUER });
    if (typeof payload.sub !== 'string' || typeof payload.email !== 'string') {
      return null;
    }
    return { sub: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}
