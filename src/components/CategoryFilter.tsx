import { useEffect, useRef, useState } from 'react';
import type { Category } from '../types';
import { CATEGORIES } from '../types';
import { useLang } from '../i18n/LanguageProvider';
import { CATEGORY_LABEL, PRIMARY_CATEGORIES, TAG_GROUPS, TAG_LABEL, UI } from '../i18n/strings';
import { CategoryDot } from './MarkerIcon';

interface Props {
  active: Set<Category>;
  counts: Record<Category, number>;
  onToggle: (category: Category) => void;
  onAll: () => void;
  activeTags?: Set<string>;
  onToggleTag?: (tag: string) => void;
  favoritesOnly?: boolean;
  onToggleFavoritesOnly?: () => void;
  favoritesCount?: number;
  hideVisited?: boolean;
  onToggleHideVisited?: () => void;
  visitedCount?: number;
}

const PRIMARY_SET = new Set<Category>(PRIMARY_CATEGORIES);

export function CategoryFilter({
  active,
  counts,
  onToggle,
  onAll,
  activeTags = new Set(),
  onToggleTag,
  favoritesOnly = false,
  onToggleFavoritesOnly,
  favoritesCount = 0,
  hideVisited = false,
  onToggleHideVisited,
  visitedCount = 0,
}: Props) {
  const { lang } = useLang();
  const allActive = active.size === CATEGORIES.length && !favoritesOnly;
  const totalCount = CATEGORIES.reduce((sum, c) => sum + (counts[c] ?? 0), 0);

  // Inline = primary list. When user has narrowed the filter (not all-on),
  // we also float any active secondary category to the inline bar so the
  // user always sees what's selected. In the default "all on" state we
  // don't float anything — that would dump all 18 categories back inline.
  const inline: Category[] = PRIMARY_CATEGORIES.slice();
  const secondary: Category[] = [];
  for (const c of CATEGORIES) {
    if (PRIMARY_SET.has(c)) continue;
    if (!allActive && active.has(c)) inline.push(c);
    else secondary.push(c);
  }
  // Badge on the "More" button: in narrow mode, show how many secondary
  // categories ARE active inside the popover (i.e. user picked them and
  // we kept them inline) — but those are now in `inline`, so this is 0.
  // Practically the badge just shows the count of categories living inside
  // the popover, so users know how many they can still toggle on.
  const hiddenCount = secondary.length;

  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on outside click + Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div
      ref={wrapRef}
      className={[
        'no-scrollbar relative flex items-center gap-1.5 px-3 py-2',
        // Mobile: wrap so every chip is reachable; desktop: single row that fits.
        'flex-wrap',
        'md:flex-nowrap md:gap-2 md:px-4 md:py-3',
      ].join(' ')}
    >
      <button
        type="button"
        onClick={onAll}
        className={[
          'snap-start shrink-0 rounded-full border px-3 py-1 text-[11px] font-medium backdrop-blur-md transition-colors md:px-3.5 md:py-1.5 md:text-xs',
          allActive
            ? 'border-ink-100/40 bg-ink-100 text-ink-950'
            : 'border-ink-700/60 bg-ink-900/85 text-ink-100 hover:border-ink-500/60',
        ].join(' ')}
      >
        {UI.all_categories[lang]}
        <span className={`ml-1.5 ${allActive ? 'text-ink-500' : 'text-ink-300'}`}>{totalCount}</span>
      </button>
      {onToggleFavoritesOnly && (
        <button
          type="button"
          onClick={onToggleFavoritesOnly}
          aria-pressed={favoritesOnly}
          className={[
            'snap-start shrink-0 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium backdrop-blur-md transition-colors md:gap-1.5 md:px-3 md:py-1.5 md:text-xs',
            favoritesOnly
              ? 'border-accent/50 bg-accent/15 text-accent'
              : 'border-ink-700/60 bg-ink-900/85 text-ink-300 hover:text-ink-100',
          ].join(' ')}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill={favoritesOnly ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          {UI.favorites_only[lang]}
          <span className={favoritesOnly ? 'text-accent/80' : 'text-ink-500'}>{favoritesCount}</span>
        </button>
      )}
      {onToggleHideVisited && visitedCount > 0 && (
        <button
          type="button"
          onClick={onToggleHideVisited}
          aria-pressed={hideVisited}
          className={[
            'snap-start shrink-0 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium backdrop-blur-md transition-colors md:gap-1.5 md:px-3 md:py-1.5 md:text-xs',
            hideVisited
              ? 'border-emerald-400/50 bg-emerald-400/15 text-emerald-300'
              : 'border-ink-700/60 bg-ink-900/85 text-ink-300 hover:text-ink-100',
          ].join(' ')}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M5 12.5l4.2 4.2L19 7" />
          </svg>
          {UI.hide_visited[lang]}
          <span className={hideVisited ? 'text-emerald-200/80' : 'text-ink-500'}>{visitedCount}</span>
        </button>
      )}

      {inline.map((c) => {
        const isActive = active.has(c);
        const count = counts[c] ?? 0;
        return (
          <button
            key={c}
            type="button"
            onClick={() => onToggle(c)}
            className={[
              'snap-start shrink-0 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium backdrop-blur-md transition-colors md:gap-1.5 md:px-3 md:py-1.5 md:text-xs',
              isActive
                ? 'border-ink-500/60 bg-ink-800/90 text-ink-100'
                : 'border-ink-700/60 bg-ink-900/85 text-ink-300 hover:text-ink-100',
            ].join(' ')}
            aria-pressed={isActive}
          >
            <CategoryDot category={c} />
            {CATEGORY_LABEL[c][lang]}
            <span className={isActive ? 'text-ink-300' : 'text-ink-500'}>{count}</span>
          </button>
        );
      })}

      {/* Active tag chips — float into the main bar so users always see
          what tag filters are applied. Click ✕ to remove. */}
      {onToggleTag && [...activeTags].map((tag) => (
        <button
          key={`tag-${tag}`}
          type="button"
          onClick={() => onToggleTag(tag)}
          className="snap-start shrink-0 inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/15 px-2.5 py-1 text-[11px] font-medium text-accent backdrop-blur-md transition-colors hover:border-accent/70 md:gap-1.5 md:px-3 md:py-1.5 md:text-xs"
          aria-label={`remove tag ${tag}`}
        >
          <span aria-hidden className="text-[9px] opacity-80">●</span>
          {TAG_LABEL[tag]?.[lang] ?? tag}
          <span aria-hidden className="text-accent/70 text-[10px]">×</span>
        </button>
      ))}
      {(hiddenCount > 0 || onToggleTag) && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className={[
            'snap-start shrink-0 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium backdrop-blur-md transition-colors md:gap-1.5 md:px-3 md:py-1.5 md:text-xs',
            open
              ? 'border-ink-100/40 bg-ink-100 text-ink-950'
              : 'border-ink-700/60 bg-ink-900/85 text-ink-300 hover:text-ink-100',
          ].join(' ')}
        >
          <span aria-hidden className="text-base leading-none">+</span>
          {UI.more_filters[lang]}
          {hiddenCount > 0 && (
            <span className={open ? 'text-ink-500' : 'text-ink-500'}>{hiddenCount}</span>
          )}
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-label={UI.filter_panel_title[lang]}
          className={[
            'absolute z-50 mt-1 w-[min(92vw,420px)] max-h-[70vh] overflow-y-auto rounded-2xl border border-ink-700/60',
            'bg-ink-900/95 p-3 shadow-2xl backdrop-blur-md',
            // Position right under the bar: anchored to the parent's bottom edge.
            'top-full right-3 md:right-4',
          ].join(' ')}
        >
          <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-wide text-ink-400 md:text-xs">
            <span>{UI.filter_panel_title[lang]}</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full px-2 py-0.5 text-ink-300 hover:text-ink-100"
            >
              {UI.filter_panel_close[lang]}
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {secondary.map((c) => {
              const isActive = active.has(c);
              const count = counts[c] ?? 0;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => onToggle(c)}
                  className={[
                    'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors md:gap-1.5 md:px-3 md:py-1.5 md:text-xs',
                    isActive
                      ? 'border-ink-500/60 bg-ink-800/90 text-ink-100'
                      : 'border-ink-700/60 bg-ink-950 text-ink-300 hover:text-ink-100',
                  ].join(' ')}
                  aria-pressed={isActive}
                >
                  <CategoryDot category={c} />
                  {CATEGORY_LABEL[c][lang]}
                  <span className={isActive ? 'text-ink-300' : 'text-ink-500'}>{count}</span>
                </button>
              );
            })}
          </div>

          {/* Tag filters, grouped. Multiple tags within or across groups
              act as OR — matches places carrying ANY of the selected tags. */}
          {onToggleTag && (
            <>
              {TAG_GROUPS.map((group) => (
                <div key={group.key} className="mt-3">
                  <div className="mb-1.5 text-[10px] uppercase tracking-wide text-ink-500 md:text-[11px]">
                    {group.label[lang]}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {group.tags.map((tag) => {
                      const isActive = activeTags.has(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => onToggleTag(tag)}
                          className={[
                            'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors md:px-3 md:py-1 md:text-xs',
                            isActive
                              ? 'border-accent/60 bg-accent/15 text-accent'
                              : 'border-ink-700/60 bg-ink-950 text-ink-300 hover:text-ink-100',
                          ].join(' ')}
                          aria-pressed={isActive}
                        >
                          {TAG_LABEL[tag]?.[lang] ?? tag}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
