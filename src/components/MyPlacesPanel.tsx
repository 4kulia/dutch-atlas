import { useEffect, useMemo } from 'react';
import { ATTRACTIONS_BY_ID } from '../data/attractions';
import { useLang } from '../i18n/LanguageProvider';
import { CATEGORY_LABEL, UI } from '../i18n/strings';
import { useMyPlaces } from '../auth/useMyPlaces';
import { CategoryDot } from './MarkerIcon';
import type { Attraction } from '../types';

interface Props {
  open: boolean;
  refreshKey: number;
  onClose: () => void;
  onSelect: (id: string) => void;
}

export function MyPlacesPanel({ open, refreshKey, onClose, onSelect }: Props) {
  const { lang } = useLang();
  const { favoriteIds, notesByAttraction } = useMyPlaces(refreshKey);

  // Aggregate: any attraction that's favorited or has notes.
  const items = useMemo(() => {
    const ids = new Set<string>([...favoriteIds, ...notesByAttraction.keys()]);
    const list: Array<{ a: Attraction; favorite: boolean; notes: number }> = [];
    for (const id of ids) {
      const a = ATTRACTIONS_BY_ID.get(id);
      if (!a) continue;
      list.push({
        a,
        favorite: favoriteIds.has(id),
        notes: notesByAttraction.get(id) ?? 0,
      });
    }
    // Favorites first, then by name.
    list.sort((x, y) => {
      if (x.favorite !== y.favorite) return x.favorite ? -1 : 1;
      return x.a.name[lang].localeCompare(y.a.name[lang]);
    });
    return list;
  }, [favoriteIds, notesByAttraction, lang]);

  // Close on Escape.
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
      {/* Backdrop on mobile */}
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

          <div className="flex-1 overflow-y-auto px-5 pb-6 md:px-6">
            {items.length === 0 ? (
              <p className="rounded-xl border border-dashed border-ink-700/40 px-4 py-8 text-center text-[13px] leading-relaxed text-ink-500">
                {UI.my_places_empty[lang]}
              </p>
            ) : (
              <ul className="divide-y divide-ink-800/50">
                {items.map(({ a, favorite, notes }) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(a.id)}
                      className="flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-ink-800/40"
                    >
                      <CategoryDot category={a.category} size={12} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-[15px] font-medium text-ink-100">
                            {a.name[lang]}
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
                        </div>
                        <div className="mt-0.5 truncate text-[12px] text-ink-500">
                          {CATEGORY_LABEL[a.category][lang]}
                          {notes > 0 && (
                            <>
                              {' · '}
                              {notes} {UI.my_places_notes_count[lang]}
                            </>
                          )}
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
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
