import { useLang } from '../i18n/LanguageProvider';

export function LanguageToggle() {
  const { lang, setLang } = useLang();
  return (
    <div
      role="group"
      aria-label="Language"
      className="inline-flex items-center rounded-full border border-ink-700/60 bg-ink-900/70 p-0.5 backdrop-blur-md"
    >
      {(['ru', 'en'] as const).map((code) => {
        const active = code === lang;
        return (
          <button
            key={code}
            type="button"
            onClick={() => setLang(code)}
            className={[
              'min-h-9 min-w-12 rounded-full px-3 text-xs font-semibold uppercase tracking-wide transition-colors',
              active
                ? 'bg-ink-100 text-ink-950'
                : 'text-ink-300 hover:text-ink-100',
            ].join(' ')}
            aria-pressed={active}
          >
            {code}
          </button>
        );
      })}
    </div>
  );
}
