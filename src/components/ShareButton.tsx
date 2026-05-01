import { useEffect, useState } from 'react';
import type { Attraction } from '../types';
import { useLang } from '../i18n/LanguageProvider';
import { UI } from '../i18n/strings';

function buildShareUrl(id: string, lang: string): string {
  if (typeof window === 'undefined') return '';
  const url = new URL(window.location.href);
  url.searchParams.set('id', id);
  url.searchParams.set('lang', lang);
  return url.toString();
}

interface Props {
  attraction: Attraction;
}

export function ShareButton({ attraction }: Props) {
  const { lang } = useLang();
  const [justCopied, setJustCopied] = useState(false);

  useEffect(() => {
    if (!justCopied) return;
    const id = window.setTimeout(() => setJustCopied(false), 2000);
    return () => window.clearTimeout(id);
  }, [justCopied]);

  const handleClick = async () => {
    const url = buildShareUrl(attraction.id, lang);
    const title = attraction.name[lang];

    // Mobile: use Web Share API for native share sheet.
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({ title, url });
        return;
      } catch (err) {
        // AbortError is fine — user dismissed. Fall through for any other error.
        if ((err as Error)?.name === 'AbortError') return;
      }
    }

    // Desktop / fallback: copy to clipboard.
    try {
      await navigator.clipboard.writeText(url);
      setJustCopied(true);
    } catch {
      // Last-ditch fallback: prompt the user with the URL.
      window.prompt(UI.share[lang], url);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center gap-2 rounded-full bg-ink-800 px-4 py-2 text-sm font-medium text-ink-100 transition-colors hover:bg-ink-700"
      aria-label={UI.share[lang]}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
        {justCopied ? (
          <path
            d="M5 12l5 5L20 7"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <>
            <circle cx="18" cy="5" r="3" stroke="currentColor" strokeWidth="1.8" />
            <circle cx="6" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
            <circle cx="18" cy="19" r="3" stroke="currentColor" strokeWidth="1.8" />
            <path
              d="M8.59 13.51l6.83 3.98M15.41 6.51L8.59 10.49"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </>
        )}
      </svg>
      {justCopied ? UI.share_copied[lang] : UI.share[lang]}
    </button>
  );
}
