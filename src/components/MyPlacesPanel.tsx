import { useEffect, useMemo } from 'react';
import { useAttractions } from '../data/AttractionsProvider';
import { useLang } from '../i18n/LanguageProvider';
import { CATEGORY_LABEL, UI } from '../i18n/strings';
import { plural } from '../i18n/plurals';
import { useMyPlaces } from '../auth/useMyPlaces';
import type { NoteRecord } from '../auth/useNotes';
import { CategoryDot } from './MarkerIcon';
import type { Attraction, Lang } from '../types';

interface Props {
  open: boolean;
  refreshKey: number;
  onClose: () => void;
  onSelect: (id: string) => void;
}

export function MyPlacesPanel({ open, refreshKey, onClose, onSelect }: Props) {
  const { lang } = useLang();
  const { byId } = useAttractions();
  const { favoriteIds, visitedIds, notesByAttraction } = useMyPlaces(refreshKey);

  const { unvisitedItems, visitedItems } = useMemo(() => {
    const ids = new Set<string>([
      ...favoriteIds,
      ...visitedIds,
      ...notesByAttraction.keys(),
    ]);
    const all: Array<{
      a: Attraction;
      favorite: boolean;
      visited: boolean;
      notes: NoteRecord[];
    }> = [];
    for (const id of ids) {
      const a = byId.get(id);
      if (!a) continue;
      all.push({
        a,
        favorite: favoriteIds.has(id),
        visited: visitedIds.has(id),
        notes: notesByAttraction.get(id) ?? [],
      });
    }
    all.sort((x, y) => {
      if (x.favorite !== y.favorite) return x.favorite ? -1 : 1;
      return x.a.name[lang].localeCompare(y.a.name[lang]);
    });
    return {
      unvisitedItems: all.filter((it) => !it.visited),
      visitedItems: all.filter((it) => it.visited),
    };
  }, [favoriteIds, visitedIds, notesByAttraction, lang, byId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] md:hidden ${
          open ? 'animate-fadeIn opacity-100' : 'pointer-events-none opacity-0'
        }`}
        aria-hidden
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={UI.my_places[lang]}
        className={[
          'fixed z-50 bg-ink-900/95 backdrop-blur-md text-ink-100 shadow-sheet',
          'transition-transform duration-300 ease-out will-change-transform',
          'inset-x-0 bottom-0 max-h-[92dvh] rounded-t-2xl border-t border-ink-700/60',
          'md:inset-x-auto md:bottom-0 md:right-0 md:top-0 md:h-full md:max-h-none md:w-[440px] md:rounded-none md:border-l md:border-t-0 md:border-ink-700/60',
          open ? 'translate-y-0 md:translate-x-0' : 'translate-y-full md:translate-y-0 md:translate-x-full',
        ].join(' ')}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex h-full max-h-[92dvh] flex-col md:max-h-none">
          <div className="md:hidden flex justify-center pt-2">
            <span aria-hidden className="h-1.5 w-10 rounded-full bg-ink-700" />
          </div>

          <header className="flex items-center justify-between gap-3 px-5 pt-3 pb-4 md:px-6 md:pt-6">
            <h2 className="text-2xl font-semibold leading-tight md:text-3xl">
              {UI.my_places[lang]}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label={UI.close[lang]}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink-300 hover:bg-ink-800 hover:text-ink-100 transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M6 6l12 12M18 6L6 18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </header>

          <div className="flex-1 overflow-y-auto px-4 pb-6 md:px-5">
            {unvisitedItems.length === 0 && visitedItems.length === 0 ? (
              <p className="rounded-xl border border-dashed border-ink-700/40 px-4 py-8 text-center text-[13px] leading-relaxed text-ink-500">
                {UI.my_places_empty[lang]}
              </p>
            ) : (
              <>
                {unvisitedItems.length > 0 && (
                  <ul className="space-y-3">
                    {unvisitedItems.map(({ a, favorite, notes }) => (
                      <PlaceCard
                        key={a.id}
                        attraction={a}
                        favorite={favorite}
                        visited={false}
                        notes={notes}
                        lang={lang}
                        onSelect={() => onSelect(a.id)}
                      />
                    ))}
                  </ul>
                )}
                {visitedItems.length > 0 && (
                  <>
                    <h3 className="mt-5 mb-2 px-1 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-emerald-300/80">
                      {UI.visited_section[lang]}
                    </h3>
                    <ul className="space-y-3">
                      {visitedItems.map(({ a, favorite, notes }) => (
                        <PlaceCard
                          key={a.id}
                          attraction={a}
                          favorite={favorite}
                          visited
                          notes={notes}
                          lang={lang}
                          onSelect={() => onSelect(a.id)}
                        />
                      ))}
                    </ul>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

interface CardProps {
  attraction: Attraction;
  favorite: boolean;
  visited: boolean;
  notes: NoteRecord[];
  lang: Lang;
  onSelect: () => void;
}

function parsePbDate(value: string): Date | null {
  if (!value) return null;
  const iso = value.includes('T') ? value : value.replace(' ', 'T');
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

function formatDate(value: string, lang: Lang): string {
  const d = parsePbDate(value);
  if (!d) return '';
  return d.toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-US', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function PlaceCard({ attraction, favorite, visited, notes, lang, onSelect }: CardProps) {
  return (
    <li
      className={[
        'overflow-hidden rounded-xl border bg-ink-900/40 transition-opacity',
        visited ? 'border-emerald-700/40 opacity-80' : 'border-ink-700/40',
      ].join(' ')}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-ink-800/40"
      >
        <CategoryDot category={attraction.category} size={12} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span
              className={[
                'truncate text-[15px] font-medium',
                visited ? 'text-ink-300' : 'text-ink-100',
              ].join(' ')}
            >
              {attraction.name[lang]}
            </span>
            {favorite && (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="shrink-0 text-accent"
                aria-hidden
              >
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            )}
            {visited && (
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="shrink-0 text-emerald-400"
                aria-hidden
              >
                <path d="M5 12.5l4.2 4.2L19 7" />
              </svg>
            )}
          </div>
          <div className="mt-0.5 truncate text-[12px] text-ink-500">
            {CATEGORY_LABEL[attraction.category][lang]}
            {notes.length > 0 && ` · ${plural('notes', notes.length, lang)}`}
          </div>
        </div>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          className="shrink-0 text-ink-500"
          aria-hidden
        >
          <path
            d="M9 6l6 6-6 6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {notes.length > 0 && (
        <ul className="space-y-1.5 border-t border-ink-700/40 bg-ink-950/30 px-3 py-2">
          {notes.map((n) => (
            <li
              key={n.id}
              className="rounded-md border border-ink-700/30 bg-ink-900/40 px-2.5 py-1.5"
            >
              <p className="whitespace-pre-line text-[13px] leading-snug text-ink-100">
                {n.body}
              </p>
              <time dateTime={n.created} className="mt-1 block text-[10px] text-ink-500">
                {formatDate(n.created, lang)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
