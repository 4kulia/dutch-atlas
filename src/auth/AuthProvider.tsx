import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiError, apiFetch } from './api';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signInWithGoogle: () => void;
  signOut: () => Promise<void>;
  error: string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Hydrate on mount from the session cookie. /api/auth/me returns 401 when
  // the cookie is absent or the session has expired — both treated as
  // signed-out, no error to surface to the user.
  useEffect(() => {
    let cancelled = false;
    apiFetch<{ user: AuthUser }>('/api/auth/me')
      .then((res) => {
        if (!cancelled) setUser(res.user);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          setUser(null);
        } else {
          console.error('[auth] /me failed', err);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const signInWithGoogle = useCallback(() => {
    setError(null);
    const returnTo = encodeURIComponent(
      window.location.pathname + window.location.search + window.location.hash,
    );
    window.location.assign(`/api/auth/google?return_to=${returnTo}`);
  }, []);

  const signOut = useCallback(async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.warn('[auth] logout failed', err);
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      isLoading,
      signInWithGoogle,
      signOut,
      error,
    }),
    [user, isLoading, signInWithGoogle, signOut, error],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
