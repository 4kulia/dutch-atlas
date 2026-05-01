import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useLang } from '../i18n/LanguageProvider';
import { useAuth } from '../auth/AuthProvider';
import { useAgentChat, type AgentMessage, type CardItem } from '../agent/useAgentChat';
import { agentBus } from '../agent/events';

// ─── Copy ───────────────────────────────────────────────────────────
const T = {
  brand: { ru: 'А·Т·Л·А·С', en: 'A·T·L·A·S' },
  title: { ru: 'Помощник', en: 'Assistant' },
  subtitle: { ru: 'Подскажет места и маршруты', en: 'Spoken to your map' },
  close: { ru: 'Закрыть', en: 'Close' },
  newChat: { ru: 'Новый разговор', en: 'New chat' },
  inputPlaceholder: {
    ru: 'Спросите про места или маршрут…',
    en: 'Ask about places or a route…',
  },
  send: { ru: 'Отправить', en: 'Send' },
  stop: { ru: 'Остановить', en: 'Stop' },
  signedOutTitle: {
    ru: 'Войдите, чтобы спросить помощника',
    en: 'Sign in to chat with the assistant',
  },
  signedOutBody: {
    ru: 'Помощник подскажет места по смыслу и составит маршрут на день. Доступно после входа через Google.',
    en: 'The assistant finds places by meaning and plans day trips. Available after Google sign-in.',
  },
  signIn: { ru: 'Войти через Google', en: 'Sign in with Google' },
  emptyHeading: { ru: 'С чего начнём?', en: 'Where to begin?' },
  emptyBody: {
    ru: 'Опишите идею в одном предложении — найду подходящие места.',
    en: 'Describe your idea in one sentence — I will find matching places.',
  },
  starters: {
    ru: ['Куда сегодня?', 'Маршрут на выходные', 'Что-то спокойное и нетуристическое'],
    en: ['Where to go today?', 'A weekend route', 'Quiet, non-touristy spots'],
  },
  cardOpen: { ru: 'Открыть', en: 'Open' },
  cardMap: { ru: 'На карте', en: 'On map' },
  errorPrefix: { ru: 'Ошибка:', en: 'Error:' },
} as const;

// ─── Snap-point machinery ───────────────────────────────────────────
type Snap = 'peek' | 'mid' | 'full';

const SNAP_DVH: Record<Snap, number> = { peek: 9, mid: 62, full: 92 };

interface Props {
  open: boolean;
  onClose: () => void;
  onSelectAttraction: (slug: string) => void;
}

export function ChatPanel({ open, onClose, onSelectAttraction }: Props) {
  const { lang } = useLang();
  const { isAuthenticated, signInWithGoogle } = useAuth();
  const chat = useAgentChat(lang);
  const [draft, setDraft] = useState('');
  const [snap, setSnap] = useState<Snap>('mid');
  const sheetRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize the textarea up to ~5 lines.
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 130)}px`;
  }, [draft]);

  // Keep the conversation pinned to the latest message.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [chat.messages, chat.isStreaming]);

  // Pull the sheet to "full" when the keyboard opens (visualViewport shrinks).
  useEffect(() => {
    if (!open || typeof window === 'undefined' || !window.visualViewport) return;
    const vv = window.visualViewport;
    const onResize = () => {
      const ratio = vv.height / window.innerHeight;
      if (ratio < 0.8 && snap !== 'full') setSnap('full');
    };
    vv.addEventListener('resize', onResize);
    return () => vv.removeEventListener('resize', onResize);
  }, [open, snap]);

  const handleSend = useCallback(() => {
    const text = draft.trim();
    if (!text || chat.isStreaming) return;
    chat.send(text);
    setDraft('');
  }, [draft, chat]);

  const handleStarter = useCallback((text: string) => {
    setDraft(text);
    inputRef.current?.focus();
  }, []);

  const cycleSnap = useCallback(() => {
    setSnap((s) => (s === 'peek' ? 'mid' : s === 'mid' ? 'full' : 'peek'));
  }, []);

  const handleCardSelect = useCallback(
    (slug: string) => {
      onSelectAttraction(slug);
    },
    [onSelectAttraction],
  );

  const handleCardShowOnMap = useCallback((slug: string) => {
    agentBus.emit({ type: 'map.show', slugs: [slug] });
  }, []);

  // Drag handler — pointer events so it works on touch + mouse + pen.
  const dragState = useRef<{ startY: number; startSnap: Snap; pointerId: number | null }>({
    startY: 0,
    startSnap: 'mid',
    pointerId: null,
  });
  const [dragOffset, setDragOffset] = useState(0);

  const onHandlePointerDown = (e: React.PointerEvent) => {
    if (window.matchMedia('(min-width: 768px)').matches) return;
    dragState.current = { startY: e.clientY, startSnap: snap, pointerId: e.pointerId };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onHandlePointerMove = (e: React.PointerEvent) => {
    if (dragState.current.pointerId !== e.pointerId) return;
    setDragOffset(e.clientY - dragState.current.startY);
  };

  const onHandlePointerUp = (e: React.PointerEvent) => {
    if (dragState.current.pointerId !== e.pointerId) return;
    const delta = e.clientY - dragState.current.startY;
    const start = dragState.current.startSnap;

    // Translate vertical drag into a target snap. Negative delta = dragging up.
    const order: Snap[] = ['peek', 'mid', 'full'];
    const idx = order.indexOf(start);
    const threshold = 60;
    let next = start;
    if (delta < -threshold && idx < 2) next = order[idx + 1] ?? 'full';
    else if (delta > threshold && idx > 0) next = order[idx - 1] ?? 'peek';

    setDragOffset(0);
    setSnap(next);
    dragState.current.pointerId = null;
  };

  const mobileHeightDvh = SNAP_DVH[snap];
  const sheetTransform = useMemo(() => {
    if (!open) return 'translateY(100%)';
    if (dragOffset !== 0) return `translateY(${dragOffset}px)`;
    return 'translateY(0)';
  }, [open, dragOffset]);

  const starters = T.starters[lang];
  const hasMessages = chat.messages.length > 0;

  return (
    <>
      <aside
        ref={sheetRef}
        role="dialog"
        aria-modal="false"
        aria-label={T.title[lang]}
        className={[
          'fixed z-40 will-change-transform select-none',
          'bg-ink-900/95 backdrop-blur-md text-ink-100',
          'shadow-sheet',
          // Mobile bottom sheet
          'inset-x-0 bottom-0 rounded-t-[20px] border-t border-ink-700/60',
          // Desktop right drawer (anchored top-to-bottom on the right)
          'md:inset-x-auto md:top-0 md:right-0 md:h-[100dvh] md:w-[440px] md:rounded-none md:border-l md:border-t-0 md:border-ink-700/60',
        ].join(' ')}
        style={{
          height: `min(${mobileHeightDvh}dvh, 92dvh)`,
          transform: sheetTransform,
          transition: dragOffset === 0 ? 'transform 280ms cubic-bezier(0.32, 0.72, 0, 1), height 280ms cubic-bezier(0.32, 0.72, 0, 1)' : 'none',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {/* — Mobile drag handle (desktop hides it) — */}
        <button
          type="button"
          onClick={cycleSnap}
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerUp}
          onPointerCancel={onHandlePointerUp}
          aria-label="resize"
          className="md:hidden flex w-full justify-center pt-2 pb-1 cursor-grab active:cursor-grabbing touch-none"
        >
          <span className="flex flex-col items-center gap-[3px]">
            <span aria-hidden className="h-[3px] w-9 rounded-full bg-ink-700" />
            <span aria-hidden className="h-[2px] w-5 rounded-full bg-ink-700/70" />
          </span>
        </button>

        <div className="flex h-full flex-col overflow-hidden">
          {/* — Header — */}
          <header className="flex items-start justify-between gap-3 px-5 pt-2 pb-3 md:pt-6">
            <div className="min-w-0">
              <div className="text-[9.5px] font-semibold tracking-[0.32em] text-accent">
                {T.brand[lang]}
              </div>
              <h2 className="mt-0.5 text-[22px] font-semibold leading-none tracking-tight text-ink-100">
                {T.title[lang]}
              </h2>
              <p className="mt-1.5 text-[11.5px] italic text-ink-500">{T.subtitle[lang]}</p>
            </div>
            <div className="flex items-center gap-1">
              {hasMessages && (
                <button
                  type="button"
                  onClick={chat.reset}
                  title={T.newChat[lang]}
                  aria-label={T.newChat[lang]}
                  className="grid h-9 w-9 place-items-center rounded-full text-ink-300 transition-colors hover:bg-ink-800 hover:text-ink-100"
                >
                  <IconRefresh />
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                aria-label={T.close[lang]}
                className="grid h-9 w-9 place-items-center rounded-full text-ink-300 transition-colors hover:bg-ink-800 hover:text-ink-100"
              >
                <IconClose />
              </button>
            </div>
          </header>

          {/* — Body — */}
          {!isAuthenticated ? (
            <SignInPanel onSignIn={signInWithGoogle} lang={lang} />
          ) : (
            <>
              <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto overscroll-contain px-5 pt-1 pb-3 [scrollbar-width:thin]"
              >
                {!hasMessages ? (
                  <EmptyState lang={lang} />
                ) : (
                  <ul className="flex flex-col gap-5">
                    {chat.messages.map((m) => (
                      <li key={m.id}>
                        {m.role === 'user' ? (
                          <UserBubble text={m.text} />
                        ) : (
                          <AssistantTurn
                            message={m}
                            lang={lang}
                            onSelectCard={handleCardSelect}
                            onMapCard={handleCardShowOnMap}
                          />
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                {chat.error && (
                  <div className="mt-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[12.5px] text-rose-200">
                    <span className="font-semibold">{T.errorPrefix[lang]}</span> {chat.error}
                  </div>
                )}
              </div>

              {/* — Composer — */}
              <div className="border-t border-ink-700/40 bg-ink-900/60 px-3 pt-2 pb-3 md:px-4">
                {!hasMessages && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {starters.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => handleStarter(s)}
                        className="group inline-flex items-center gap-1.5 rounded-full border border-ink-700/60 bg-ink-900/60 px-2.5 py-1 text-[11.5px] text-ink-300 transition-colors hover:border-accent/50 hover:text-ink-100"
                      >
                        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent/60 transition-colors group-hover:bg-accent" />
                        {s}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex items-end gap-2">
                  <textarea
                    ref={inputRef}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onFocus={() => snap === 'peek' && setSnap('mid')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder={T.inputPlaceholder[lang]}
                    rows={1}
                    className="flex-1 resize-none rounded-2xl border border-ink-700/60 bg-ink-950/60 px-3.5 py-2.5 text-[14px] leading-snug text-ink-100 placeholder:text-ink-500 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/25"
                  />
                  {chat.isStreaming ? (
                    <button
                      type="button"
                      onClick={chat.stop}
                      title={T.stop[lang]}
                      aria-label={T.stop[lang]}
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink-800 text-ink-100 transition-colors hover:bg-ink-700"
                    >
                      <IconStop />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSend}
                      disabled={!draft.trim()}
                      title={T.send[lang]}
                      aria-label={T.send[lang]}
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent text-ink-950 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <IconSend />
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </aside>
    </>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[88%] rounded-[16px] rounded-br-md border border-accent/35 bg-accent/15 px-3.5 py-2 text-[14px] leading-snug text-ink-100">
        {text}
      </div>
    </div>
  );
}

function AssistantTurn({
  message,
  lang,
  onSelectCard,
  onMapCard,
}: {
  message: AgentMessage;
  lang: 'ru' | 'en';
  onSelectCard: (slug: string) => void;
  onMapCard: (slug: string) => void;
}) {
  const showCaret = message.isStreaming && message.text.length > 0;
  return (
    <div className="flex flex-col gap-3">
      {(message.text || showCaret) && (
        <div className="text-[14px] leading-relaxed text-ink-100">
          <span className="whitespace-pre-line">{message.text}</span>
          {showCaret && (
            <span
              aria-hidden
              className="ml-0.5 inline-block h-[14px] w-[2px] -translate-y-[1px] animate-caret bg-accent"
              style={{ verticalAlign: 'text-bottom' }}
            />
          )}
        </div>
      )}

      {message.toolHints && message.toolHints.length > 0 && (
        <ul className="flex flex-col gap-1">
          {message.toolHints.map((h, i) => (
            <li key={i} className="text-[12px] italic text-ink-500">
              {h}
            </li>
          ))}
        </ul>
      )}

      {message.cards && message.cards.length > 0 && (
        <ul className="flex flex-col gap-2">
          {message.cards.map((c) => (
            <CardRow
              key={`${message.id}-${c.slug}`}
              card={c}
              lang={lang}
              onSelect={onSelectCard}
              onMap={onMapCard}
            />
          ))}
        </ul>
      )}

      {/* tiny caret blink keyframes — colocated since Tailwind has no built-in */}
      <style>{`
        @keyframes caret-blink { 0%, 60% { opacity: 1; } 60.01%, 100% { opacity: 0; } }
        .animate-caret { animation: caret-blink 1.05s steps(1, end) infinite; }
      `}</style>
    </div>
  );
}

function CardRow({
  card,
  lang,
  onSelect,
  onMap,
}: {
  card: CardItem;
  lang: 'ru' | 'en';
  onSelect: (slug: string) => void;
  onMap: (slug: string) => void;
}) {
  const colorVar = `var(--cat-${card.category}, #64748b)`;
  return (
    <li>
      <div
        className="group relative flex items-stretch overflow-hidden rounded-[14px] border border-ink-700/55 bg-ink-950/55 transition-colors hover:border-accent/40"
        style={{
          // Inline CSS variables let the dot color work without listing every cat in tailwind.
          // The fallback color matches `cat.other`.
          ['--cat-city_large' as never]: '#e11d48',
          ['--cat-city_historic' as never]: '#f59e0b',
          ['--cat-village' as never]: '#84cc16',
          ['--cat-hydraulic' as never]: '#0ea5e9',
          ['--cat-wind' as never]: '#06b6d4',
          ['--cat-nature' as never]: '#10b981',
          ['--cat-castle' as never]: '#a855f7',
          ['--cat-caribbean' as never]: '#ec4899',
          ['--cat-other' as never]: '#64748b',
        }}
      >
        <span
          aria-hidden
          className="block w-[3px] shrink-0"
          style={{ background: colorVar }}
        />

        <button
          type="button"
          onClick={() => onSelect(card.slug)}
          className="flex flex-1 items-start gap-3 px-3 py-2.5 text-left"
        >
          <span
            aria-hidden
            className="mt-1 inline-block h-[8px] w-[8px] shrink-0 rounded-full"
            style={{ background: colorVar, boxShadow: `0 0 0 3px ${colorVar}1A` }}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="truncate text-[14px] font-medium text-ink-100">
                {card.name}
              </span>
              {typeof card.score === 'number' && <ScoreBadge value={card.score} />}
            </div>
            {card.short && (
              <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-ink-300">
                {card.short}
              </p>
            )}
          </div>
        </button>

        <div className="flex shrink-0 flex-col items-stretch border-l border-ink-700/40">
          <button
            type="button"
            onClick={() => onMap(card.slug)}
            title={lang === 'ru' ? 'На карте' : 'On map'}
            aria-label={lang === 'ru' ? 'На карте' : 'On map'}
            className="grid flex-1 place-items-center px-3 text-ink-500 transition-colors hover:bg-ink-800/60 hover:text-accent"
          >
            <IconPin />
          </button>
          <span aria-hidden className="block h-px w-full bg-ink-700/40" />
          <button
            type="button"
            onClick={() => onSelect(card.slug)}
            title={lang === 'ru' ? 'Открыть' : 'Open'}
            aria-label={lang === 'ru' ? 'Открыть' : 'Open'}
            className="grid flex-1 place-items-center px-3 text-ink-500 transition-colors hover:bg-ink-800/60 hover:text-ink-100"
          >
            <IconArrowRight />
          </button>
        </div>
      </div>
    </li>
  );
}

function ScoreBadge({ value }: { value: number }) {
  const text = value.toFixed(2);
  return (
    <span
      className="relative inline-flex items-center px-2 py-[1px] text-[10px] font-medium text-ink-300 tabular-nums"
      aria-label={`relevance ${text}`}
    >
      <span aria-hidden className="absolute left-0 top-0 h-1.5 w-1.5 border-l border-t border-ink-500/60" />
      <span aria-hidden className="absolute right-0 top-0 h-1.5 w-1.5 border-r border-t border-ink-500/60" />
      <span aria-hidden className="absolute left-0 bottom-0 h-1.5 w-1.5 border-l border-b border-ink-500/60" />
      <span aria-hidden className="absolute right-0 bottom-0 h-1.5 w-1.5 border-r border-b border-ink-500/60" />
      {text}
    </span>
  );
}

function EmptyState({ lang }: { lang: 'ru' | 'en' }) {
  return (
    <div className="flex h-full flex-col items-start justify-end gap-2 pb-2 text-ink-300">
      <h3 className="text-[18px] font-medium leading-tight text-ink-100">
        {T.emptyHeading[lang]}
      </h3>
      <p className="text-[13px] leading-snug text-ink-300 max-w-[34ch]">
        {T.emptyBody[lang]}
      </p>
    </div>
  );
}

function SignInPanel({ onSignIn, lang }: { onSignIn: () => void; lang: 'ru' | 'en' }) {
  return (
    <div className="flex flex-1 flex-col items-start justify-center gap-3 px-5 pb-6">
      <div className="text-[10px] font-semibold tracking-[0.28em] text-accent">
        {lang === 'ru' ? 'НУЖЕН ВХОД' : 'SIGN-IN REQUIRED'}
      </div>
      <h3 className="text-[18px] font-medium leading-snug text-ink-100">
        {T.signedOutTitle[lang]}
      </h3>
      <p className="max-w-[42ch] text-[13px] leading-relaxed text-ink-300">
        {T.signedOutBody[lang]}
      </p>
      <button
        type="button"
        onClick={onSignIn}
        className="mt-1 inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-[13px] font-medium text-ink-950 transition-opacity hover:opacity-90"
      >
        <GoogleGlyph />
        {T.signIn[lang]}
      </button>
    </div>
  );
}

// ─── Icons (inline SVG, no deps) ────────────────────────────────────

function IconClose() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function IconRefresh() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M21 12a9 9 0 11-3.34-7M21 4v5h-5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function IconSend() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 12h14M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function IconStop() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
      <rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor" />
    </svg>
  );
}
function IconPin() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 21s7-7 7-12a7 7 0 10-14 0c0 5 7 12 7 12z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
function IconArrowRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function GoogleGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
      <path
        d="M21.35 11.1H12v3.2h5.35c-.23 1.4-1.71 4.1-5.35 4.1-3.22 0-5.85-2.66-5.85-5.95s2.63-5.95 5.85-5.95c1.83 0 3.06.78 3.76 1.45l2.56-2.46C16.79 3.97 14.62 3 12 3 6.99 3 3 6.99 3 12s3.99 9 9 9c5.2 0 8.62-3.65 8.62-8.79 0-.59-.06-1.04-.27-2.11z"
        fill="#fff"
      />
    </svg>
  );
}
