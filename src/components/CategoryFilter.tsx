import type { Category } from '../types';
import { CATEGORIES } from '../types';
import { useLang } from '../i18n/LanguageProvider';
import { CATEGORY_LABEL, UI } from '../i18n/strings';
import { CategoryDot } from './MarkerIcon';

interface Props {
  active: Set<Category>;
  counts: Record<Category, number>;
  onToggle: (category: Category) => void;
  onAll: () => void;
  favoritesOnly?: boolean;
  onToggleFavoritesOnly?: () => void;
  favoritesCount?: number;
  hideVisited?: boolean;
  onToggleHideVisited?: () => void;
  visitedCount?: number;
}

export function CategoryFilter({
  active,
  counts,
  onToggle,
  onAll,
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

  return (
    <div
      className={[
        'no-scrollbar flex items-center gap-1.5 px-3 py-2',
        // Mobile: wrap onto multiple rows so every chip is reachable.
        'flex-wrap',
        // Desktop: single horizontal row (chips fit on wider screens).
        'md:flex-nowrap md:gap-2 md:overflow-x-auto md:px-4 md:py-3',
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
      {CATEGORIES.map((c) => {
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
    </div>
  );
}
