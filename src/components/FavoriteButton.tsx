import { useAuth } from '../auth/AuthProvider';
import { useLang } from '../i18n/LanguageProvider';
import { UI } from '../i18n/strings';

interface Props {
  active: boolean;
  onToggle: () => void;
  onPromptLogin: () => void;
}

export function FavoriteButton({ active, onToggle, onPromptLogin }: Props) {
  const { isAuthenticated } = useAuth();
  const { lang } = useLang();
  const label = active ? UI.favorite_remove[lang] : UI.favorite_add[lang];

  return (
    <button
      type="button"
      onClick={isAuthenticated ? onToggle : onPromptLogin}
      aria-pressed={active}
      aria-label={label}
      className={[
        'inline-flex h-10 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-all',
        active
          ? 'border-accent/40 bg-accent/15 text-accent'
          : 'border-ink-700/60 bg-ink-900/60 text-ink-100 hover:border-ink-500/60',
      ].join(' ')}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        className="transition-transform"
        style={{ transform: active ? 'scale(1.05)' : 'scale(1)' }}
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
