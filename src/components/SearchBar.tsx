import { useEffect, useMemo, useRef, useState } from 'react';
import { ATTRACTIONS } from '../data/attractions';
import { CATEGORY_LABEL, UI } from '../i18n/strings';
import { useLang } from '../i18n/LanguageProvider';
import { CategoryDot } from './MarkerIcon';
import type { Attraction } from '../types';

interface Props {
  onSelect: (id: string) => void;
}

const MAX_RESULTS = 8;

function score(query: string, a: Attraction): number {
  const q = query.toLowerCase();
  const ru = a.name.ru.toLowerCase();
  const en = a.name.en.toLowerCase();
  if (ru === q || en === q) return 100;
  if (ru.startsWith(q) || en.startsWith(q)) return 80;
  if (ru.includes(q) || en.includes(q)) return 60;
  // Fuzzy fallback against short description.
  if (a.short.ru.toLowerCase().includes(q) || a.short.en.toLowerCase().includes(q)) return 30;
  return 0;
}

export function SearchBar({ onSelect }: Props) {
  const { lang } = useLang();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [expanded, setExpanded] = useState(false); // mobile: icon-only by default
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const q = query.trim();
    if (q.length < 1) return [];
    return ATTRACTIONS.map((a) => ({ a, s: score(q, a) }))
      .filter((x) => x.s > 0)
      .sort((x, y) => y.s - x.s)
      .slice(0, MAX_RESULTS)
      .map((x) => x.a);
  }, [query]);

  // Reset active index when results change.
  useEffect(() => {
    setActiveIndex(0);
  }, [results.length]);

  // Close on click outside or Escape.
  useEffect(() => {
    if (!open && !expanded) return;
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false);
        if (!query) setExpanded(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setExpanded(false);
        inputRef.current?.blur();
      }
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, expanded, query]);

  const choose = (id: string) => {
    onSelect(id);
    setQuery('');
    setOpen(false);
    setExpanded(false);
    inputRef.current?.blur();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const r = results[activeIndex];
      if (r) choose(r.id);
    }
  };

  const placeholder = UI.search_placeholder[lang];

  return (
    <div ref={wrapRef} className="relative">
      <div
        className={[
          'flex items-center gap-1.5 rounded-full border border-ink-700/60 bg-ink-900/85 backdrop-blur-md transition-[width] duration-200 ease-out',
          // Mobile: collapsed (icon only) unless expanded.
          expanded ? 'w-[78vw] max-w-[420px] px-3 py-1.5' : 'w-9 h-9 px-0 py-0 justify-center',
          // Desktop: always expanded.
          'md:w-[280px] md:px-3 md:py-1.5',
        ].join(' ')}
      >
        <button
          type="button"
          onClick={() => {
            setExpanded(true);
            setOpen(true);
            setTimeout(() => inputRef.current?.focus(), 50);
          }}
          aria-label={placeholder}
          className="grid h-9 w-9 shrink-0 place-items-center text-ink-300 md:h-auto md:w-auto md:cursor-text"
          tabIndex={expanded ? -1 : 0}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
            <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className={[
            'min-w-0 flex-1 bg-transparent text-[13px] text-ink-100 placeholder:text-ink-500 focus:outline-none',
            // On mobile, hide the input until the icon is tapped.
            expanded ? 'block' : 'hidden',
            'md:block',
          ].join(' ')}
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls="search-results"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
            aria-label="clear"
            className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-ink-500 hover:text-ink-100"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>

      {open && query.trim() && (
        <ul
          id="search-results"
          role="listbox"
          className="absolute right-0 top-[calc(100%+6px)] z-50 w-[min(92vw,420px)] overflow-hidden rounded-2xl border border-ink-700/60 bg-ink-900/95 shadow-2xl backdrop-blur-md"
        >
          {results.length === 0 ? (
            <li className="px-4 py-3 text-[13px] text-ink-500">{UI.no_results[lang]}</li>
          ) : (
            results.map((a, idx) => (
              <li key={a.id} role="option" aria-selected={idx === activeIndex}>
                <button
                  type="button"
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => choose(a.id)}
                  className={[
                    'flex w-full items-center gap-2.5 px-4 py-2.5 text-left transition-colors',
                    idx === activeIndex ? 'bg-ink-800/80' : 'hover:bg-ink-800/60',
                  ].join(' ')}
                >
                  <CategoryDot category={a.category} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium text-ink-100">
                      {a.name[lang]}
                    </div>
                    <div className="truncate text-[11px] text-ink-500">
                      {CATEGORY_LABEL[a.category][lang]} · {a.videoTimeFormatted}
                    </div>
                  </div>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
