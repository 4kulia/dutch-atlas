import { useState } from 'react';
import { useLang } from '../i18n/LanguageProvider';
import { UI } from '../i18n/strings';
import { LanguageToggle } from './LanguageToggle';
import { UserMenu } from './UserMenu';
import { SearchBar } from './SearchBar';

interface Props {
  onSelectAttraction: (id: string) => void;
  onOpenMyPlaces: () => void;
  onOpenChat: () => void;
}

const CHAT_LABEL = { ru: 'Помощник', en: 'Assistant' } as const;

export function Header({ onSelectAttraction, onOpenMyPlaces, onOpenChat }: Props) {
  const { lang } = useLang();
  // On mobile, the search bar expands to ~78vw which doesn't leave room
  // for the logo pill + the right-side action buttons. When the user taps
  // the search icon we hide the logo pill so the search field has space.
  const [searchExpanded, setSearchExpanded] = useState(false);
  return (
    <header
      className="pointer-events-none absolute inset-x-0 top-0 z-30"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="pointer-events-auto mx-auto flex max-w-[1600px] items-center gap-2 px-3 py-3 md:gap-3 md:px-5 md:py-4">
        <div
          className={[
            'items-center gap-2.5 rounded-full border border-ink-700/60 bg-ink-900/70 px-3 py-1.5 backdrop-blur-md',
            // Hide the logo pill on mobile while search is expanded.
            searchExpanded ? 'hidden md:flex' : 'flex',
          ].join(' ')}
        >
          <Logo />
          <div className="flex flex-col leading-none">
            <span className="text-[13px] font-semibold text-ink-100">
              {UI.app_title[lang]}
            </span>
            <a
              href="https://x.com/ai_kulikov"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-0.5 text-[9.5px] font-medium tracking-wide text-ink-500 transition-colors hover:text-accent"
            >
              by @ai_kulikov
            </a>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <SearchBar onSelect={onSelectAttraction} onExpandChange={setSearchExpanded} />
          <button
            type="button"
            onClick={onOpenChat}
            title={CHAT_LABEL[lang]}
            aria-label={CHAT_LABEL[lang]}
            className="group inline-flex h-9 items-center gap-2 rounded-full border border-ink-700/60 bg-ink-900/85 px-3 text-xs font-medium text-ink-100 backdrop-blur-md transition-colors hover:border-accent/50"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden
              className="text-accent"
            >
              <path
                d="M4 12a8 8 0 0114.5-4.6L21 6l-1 4.5L17 9l1.5-2A6 6 0 106 12c0 .9.2 1.7.5 2.5L4 18l3.5-1.5C8.3 18.5 10 19 12 19a8 8 0 008-7"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="9" cy="12" r="1" fill="currentColor" />
              <circle cx="13" cy="12" r="1" fill="currentColor" />
              <circle cx="17" cy="12" r="1" fill="currentColor" />
            </svg>
            <span className="hidden sm:inline">{CHAT_LABEL[lang]}</span>
          </button>
          <UserMenu onOpenMyPlaces={onOpenMyPlaces} />
          <LanguageToggle />
        </div>
      </div>
    </header>
  );
}

function Logo() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M16 4c5.523 0 10 4.378 10 9.778C26 21.111 16 28 16 28S6 21.111 6 13.778C6 8.378 10.477 4 16 4z"
        fill="#ff6a3d"
      />
      <circle cx="16" cy="13.5" r="3.6" fill="#0b0f17" />
    </svg>
  );
}
