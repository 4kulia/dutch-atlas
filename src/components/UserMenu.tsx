import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { useLang } from '../i18n/LanguageProvider';
import type { Lang } from '../types';

const LABELS = {
  sign_in: { ru: 'Войти через Google', en: 'Sign in with Google' },
  sign_in_short: { ru: 'Войти', en: 'Sign in' },
  sign_out: { ru: 'Выйти', en: 'Sign out' },
  signing_in: { ru: 'Входим…', en: 'Signing in…' },
  my_places: { ru: 'Мои места', en: 'My places' },
} as const;

function t(key: keyof typeof LABELS, lang: Lang): string {
  return LABELS[key][lang];
}

interface Props {
  onOpenMyPlaces?: () => void;
}

export function UserMenu({ onOpenMyPlaces }: Props = {}) {
  const { user, signInWithGoogle, signOut, isSigningIn, error } = useAuth();
  const { lang } = useLang();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!user) {
    return (
      <button
        type="button"
        onClick={signInWithGoogle}
        disabled={isSigningIn}
        title={error ?? undefined}
        className="inline-flex h-9 items-center gap-2 rounded-full border border-ink-700/60 bg-ink-900/85 px-3 text-xs font-medium text-ink-100 backdrop-blur-md transition-colors hover:border-ink-500/60 disabled:opacity-60"
      >
        <GoogleGlyph />
        <span className="hidden sm:inline">
          {isSigningIn ? t('signing_in', lang) : t('sign_in', lang)}
        </span>
        <span className="sm:hidden">{t('sign_in_short', lang)}</span>
      </button>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 items-center gap-2 rounded-full border border-ink-700/60 bg-ink-900/85 pl-1 pr-3 text-xs font-medium text-ink-100 backdrop-blur-md transition-colors hover:border-ink-500/60"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Avatar user={user} />
        <span className="hidden sm:inline max-w-[140px] truncate">{user.name}</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+6px)] z-50 w-56 overflow-hidden rounded-2xl border border-ink-700/60 bg-ink-900/95 text-sm text-ink-100 shadow-2xl backdrop-blur-md"
        >
          <div className="border-b border-ink-700/40 px-4 py-3">
            <div className="font-medium">{user.name}</div>
            <div className="truncate text-[11px] text-ink-300">{user.email}</div>
          </div>
          {onOpenMyPlaces && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onOpenMyPlaces();
              }}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left transition-colors hover:bg-ink-800/80"
              role="menuitem"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              {t('my_places', lang)}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              signOut();
            }}
            className="block w-full px-4 py-2.5 text-left transition-colors hover:bg-ink-800/80"
            role="menuitem"
          >
            {t('sign_out', lang)}
          </button>
        </div>
      )}
    </div>
  );
}

function Avatar({ user }: { user: { name: string; avatar?: string } }) {
  if (user.avatar) {
    return (
      <img
        src={user.avatar}
        alt=""
        className="h-7 w-7 rounded-full object-cover"
        referrerPolicy="no-referrer"
      />
    );
  }
  const initial = user.name.charAt(0).toUpperCase() || 'U';
  return (
    <span className="grid h-7 w-7 place-items-center rounded-full bg-accent text-[11px] font-semibold text-ink-950">
      {initial}
    </span>
  );
}

function GoogleGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303C33.5 32.91 29.07 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039L37.62 9.34C34.046 6.053 29.268 4 24 4 13.507 4 5 12.507 5 23s8.507 19 19 19 19-8.507 19-19c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 16.108 19.001 13 24 13c3.059 0 5.842 1.154 7.961 3.039L37.62 10.34C34.046 7.053 29.268 5 24 5 16.318 5 9.656 9.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 43c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 33.91 26.715 35 24 35c-5.045 0-9.262-3.078-10.948-7.398l-6.522 5.025C9.466 38.556 16.227 43 24 43z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.002-.001 6.19 5.238C36.971 39.205 44 34 44 23c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}
