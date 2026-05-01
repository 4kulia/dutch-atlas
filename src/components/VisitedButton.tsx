import { useAuth } from '../auth/AuthProvider';
import { useLang } from '../i18n/LanguageProvider';
import { UI } from '../i18n/strings';

interface Props {
  active: boolean;
  onToggle: () => void;
  onPromptLogin: () => void;
}

export function VisitedButton({ active, onToggle, onPromptLogin }: Props) {
  const { isAuthenticated } = useAuth();
  const { lang } = useLang();
  const label = active ? UI.visited_remove[lang] : UI.visited_add[lang];

  return (
    <button
      type="button"
      onClick={isAuthenticated ? onToggle : onPromptLogin}
      aria-pressed={active}
      aria-label={label}
      className={[
        'inline-flex h-10 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-all',
        active
          ? 'border-emerald-400/40 bg-emerald-400/15 text-emerald-300'
          : 'border-ink-700/60 bg-ink-900/60 text-ink-100 hover:border-ink-500/60',
      ].join(' ')}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {active ? (
          // Filled circle with check.
          <>
            <circle cx="12" cy="12" r="9" fill="currentColor" stroke="none" opacity="0.18" />
            <path d="M7 12.5l3.2 3.2L17 9" />
          </>
        ) : (
          // Outline check only.
          <path d="M5 12.5l4.2 4.2L19 7" />
        )}
      </svg>
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
