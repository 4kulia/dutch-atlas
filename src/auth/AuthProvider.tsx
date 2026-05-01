import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { pb, toAuthUser, type AuthUser } from './pb';

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => void;
  isSigningIn: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => toAuthUser(pb.authStore.record));
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // pb.authStore persists in localStorage across reloads. Subscribe to changes
  // (login/logout/refresh) and mirror them into React state.
  useEffect(() => {
    const unsubscribe = pb.authStore.onChange(() => {
      setUser(toAuthUser(pb.authStore.record));
    });
    return () => unsubscribe();
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setError(null);
    setIsSigningIn(true);
    try {
      await pb.collection('users').authWithOAuth2({ provider: 'google' });
      // The store change above will populate `user`.
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign-in failed';
      // Distinguish user closing the popup from real failures.
      if (!/cancel|popup|abort/i.test(message)) {
        setError(message);
        console.error('[auth] Google sign-in failed', err);
      }
    } finally {
      setIsSigningIn(false);
    }
  }, []);

  const signOut = useCallback(() => {
    pb.authStore.clear();
    setError(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      signInWithGoogle,
      signOut,
      isSigningIn,
      error,
    }),
    [user, signInWithGoogle, signOut, isSigningIn, error],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
