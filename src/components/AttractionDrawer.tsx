import { useEffect, useState } from 'react';
import type { Attraction } from '../types';
import { useLang } from '../i18n/LanguageProvider';
import { CATEGORY_LABEL, TAG_LABEL, UI } from '../i18n/strings';
import { VideoEmbed } from './VideoEmbed';
import { CategoryDot } from './MarkerIcon';
import { FavoriteButton } from './FavoriteButton';
import { VisitedButton } from './VisitedButton';
import { NotesPanel } from './NotesPanel';
import { ShareButton } from './ShareButton';
import { useAuth } from '../auth/AuthProvider';

interface Props {
  attraction: Attraction | null;
  onClose: () => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  isVisited: boolean;
  onToggleVisited: () => void;
  activeTags?: Set<string>;
  onToggleTag?: (tag: string) => void;
}

export function AttractionDrawer({
  attraction,
  onClose,
  isFavorite,
  onToggleFavorite,
  isVisited,
  onToggleVisited,
  activeTags,
  onToggleTag,
}: Props) {
  const { lang } = useLang();
  const { isAuthenticated, signInWithGoogle } = useAuth();
  const [expanded, setExpanded] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [showLoginHint, setShowLoginHint] = useState(false);

  useEffect(() => {
    if (attraction) {
      setMounted(true);
      setExpanded(true);
      setShowLoginHint(false);
    }
  }, [attraction]);

  useEffect(() => {
    if (!attraction) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [attraction, onClose]);

  if (!attraction && !mounted) return null;

  return (
    <>
      {/* Backdrop on mobile */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] md:hidden ${
          attraction ? 'animate-fadeIn opacity-100' : 'pointer-events-none opacity-0'
        }`}
        aria-hidden
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={attraction?.name[lang] ?? ''}
        className={[
          'fixed z-50 bg-ink-900/95 backdrop-blur-md text-ink-100 shadow-sheet',
          'transition-transform duration-300 ease-out will-change-transform',
          // Mobile: bottom sheet
          'inset-x-0 bottom-0 max-h-[92dvh] rounded-t-2xl border-t border-ink-700/60',
          // Desktop: side drawer
          'md:inset-x-auto md:bottom-0 md:right-0 md:top-0 md:h-full md:max-h-none md:w-[440px] md:rounded-none md:border-l md:border-t-0 md:border-ink-700/60',
          attraction
            ? 'translate-y-0 md:translate-x-0'
            : 'translate-y-full md:translate-y-0 md:translate-x-full',
        ].join(' ')}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {attraction && (
          <div className="flex h-full max-h-[92dvh] flex-col md:max-h-none">
            {/* Drag handle (mobile) */}
            <div className="md:hidden flex justify-center pt-2">
              <span aria-hidden className="h-1.5 w-10 rounded-full bg-ink-700" />
            </div>

            <header className="flex items-start gap-3 px-5 pt-3 pb-4 md:px-6 md:pt-6">
              <div className="flex-1 min-w-0">
                <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-ink-300">
                  <CategoryDot category={attraction.category} />
                  <span>{CATEGORY_LABEL[attraction.category][lang]}</span>
                  {attraction.videoTimeFormatted && (
                    <>
                      <span aria-hidden>·</span>
                      <span className="font-mono">{attraction.videoTimeFormatted}</span>
                    </>
                  )}
                </div>
                <h2 className="text-2xl font-semibold leading-tight md:text-3xl">
                  {attraction.name[lang]}
                </h2>
                {attraction.tags && attraction.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {attraction.tags.map((tag) => {
                      const label = TAG_LABEL[tag]?.[lang] ?? tag;
                      const isActive = activeTags?.has(tag) ?? false;
                      // Click → toggle the global tag filter so users can
                      // jump from "this place is spooky" to "show me all
                      // spooky places". Falls back to non-clickable span
                      // when no handler is wired.
                      return onToggleTag ? (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => onToggleTag(tag)}
                          aria-pressed={isActive}
                          className={[
                            'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors md:text-[11px]',
                            isActive
                              ? 'bg-accent/20 text-accent ring-1 ring-accent/50'
                              : 'bg-ink-800/70 text-ink-200 hover:bg-ink-700/70',
                          ].join(' ')}
                        >
                          {label}
                        </button>
                      ) : (
                        <span
                          key={tag}
                          className="inline-flex items-center rounded-full bg-ink-800/70 px-2 py-0.5 text-[10px] font-medium text-ink-200 md:text-[11px]"
                        >
                          {label}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
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

            <div className="flex-1 overflow-y-auto px-5 md:px-6">
              {attraction.videoId && attraction.videoTime != null && (
                <>
                  <VideoEmbed
                    key={attraction.id}
                    videoId={attraction.videoId}
                    startSeconds={attraction.videoTime}
                    title={attraction.name[lang]}
                    lang={lang}
                  />

                  <p className="mt-3 text-[12px] leading-snug text-ink-500">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      className="mr-1 -mb-0.5 inline-block align-text-bottom"
                      aria-hidden
                    >
                      <path
                        d="M12 9v4m0 4h.01M10.29 3.86l-8.41 14.55A2 2 0 003.62 21h16.76a2 2 0 001.74-2.59L13.71 3.86a2 2 0 00-3.42 0z"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    {UI.audio_hint[lang]}
                  </p>
                </>
              )}

              <p className="mt-5 text-[15px] leading-relaxed text-ink-100">
                {capitalize(attraction.short[lang])}
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-2">
                <FavoriteButton
                  active={isFavorite}
                  onToggle={onToggleFavorite}
                  onPromptLogin={() => setShowLoginHint(true)}
                />
                <VisitedButton
                  active={isVisited}
                  onToggle={onToggleVisited}
                  onPromptLogin={() => setShowLoginHint(true)}
                />
                {!isAuthenticated && showLoginHint && (
                  <button
                    type="button"
                    onClick={signInWithGoogle}
                    className="text-[12px] text-accent hover:text-accent-soft transition-colors"
                  >
                    {UI.favorite_login_required[lang]}
                  </button>
                )}
              </div>

              {attraction.full[lang] && attraction.full[lang] !== attraction.short[lang] && (
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => setExpanded((v) => !v)}
                    className="text-sm font-medium text-accent hover:text-accent-soft transition-colors"
                  >
                    {(expanded ? UI.show_less : UI.show_more)[lang]}
                    <span className="ml-1 inline-block transition-transform" style={{ transform: expanded ? 'rotate(180deg)' : 'none' }}>
                      ▾
                    </span>
                  </button>
                  <div
                    className={`grid transition-all duration-300 ease-out ${
                      expanded ? 'mt-3 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                    }`}
                  >
                    <div className="overflow-hidden">
                      <p className="whitespace-pre-line text-[14px] leading-relaxed text-ink-300">
                        {attraction.full[lang]}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-6 mb-6 flex flex-wrap gap-2">
                {attraction.videoId && attraction.videoTime != null && (
                  <a
                    href={`https://youtu.be/${attraction.videoId}?t=${attraction.videoTime}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full bg-ink-800 px-4 py-2 text-sm font-medium text-ink-100 hover:bg-ink-700 transition-colors"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                      <path d="M21.582 6.186a2.506 2.506 0 0 0-1.768-1.768C18.254 4 12 4 12 4s-6.254 0-7.814.418A2.506 2.506 0 0 0 2.418 6.186 26.07 26.07 0 0 0 2 12a26.07 26.07 0 0 0 .418 5.814 2.506 2.506 0 0 0 1.768 1.768C5.746 20 12 20 12 20s6.254 0 7.814-.418a2.506 2.506 0 0 0 1.768-1.768A26.07 26.07 0 0 0 22 12a26.07 26.07 0 0 0-.418-5.814zM10 15.464V8.536L16 12l-6 3.464z" />
                    </svg>
                    {UI.open_in_youtube[lang]}
                  </a>
                )}
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${attraction.coordinates.lat},${attraction.coordinates.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-ink-800 px-4 py-2 text-sm font-medium text-ink-100 hover:bg-ink-700 transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinejoin="round"
                    />
                    <circle cx="12" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.8" />
                  </svg>
                  {UI.open_in_maps[lang]}
                </a>
                <ShareButton attraction={attraction} />
              </div>

              {isAuthenticated && <NotesPanel attractionId={attraction.id} />}

              <div className="h-6" />
            </div>
          </div>
        )}
      </aside>
    </>
  );
}

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
