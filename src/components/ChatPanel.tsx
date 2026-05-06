import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { useLang } from '../i18n/LanguageProvider';
import { useAuth } from '../auth/AuthProvider';
import { useAttractions } from '../data/AttractionsProvider';
import { useAgentChat, type AgentMessage, type AttachmentRef, type CardItem, type RouteCardData } from '../agent/useAgentChat';
import { agentBus } from '../agent/events';
import { renderMarkdown } from '../agent/markdown';
import { useRouteDirections, findLeg } from '../agent/routeDirections';
import {
  TRAVEL_MODE_LABEL,
  TRAVEL_MODE_ORDER,
  type TravelMode,
} from '../agent/travelMode';

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

// Heights are in `svh` (small viewport height) — guaranteed to fit even when
// the iOS Safari URL bar is fully visible. Using `dvh` here looked correct on
// desktop but cropped the composer on iPhone Safari because dvh shrinks
// asynchronously while the bar transitions.
const SNAP_DVH: Record<Snap, number> = { peek: 9, mid: 62, full: 92 };

interface Props {
  open: boolean;
  onClose: () => void;
  onSelectAttraction: (slug: string) => void;
  travelMode: TravelMode;
  onTravelModeChange: (mode: TravelMode) => void;
  activeRouteSig: string | null;
  onActivateRoute: (sig: string, data: RouteCardData) => void;
  // App can prefill the composer (FAB "I'm here" path) or trigger an
  // immediate send (after the user picks a point on the map). Each ping
  // carries a fresh id so ChatPanel can detect re-entries via useEffect deps.
  composerPrefill?: { id: string; text: string } | null;
  autoSend?: { id: string; text: string } | null;
}

interface SessionListItem {
  id: string;
  title: string;
  preview: string | null;
  updatedAt: string;
}

export function ChatPanel({
  open,
  onClose,
  onSelectAttraction,
  travelMode,
  onTravelModeChange,
  activeRouteSig,
  onActivateRoute,
  composerPrefill,
  autoSend,
}: Props) {
  const { lang } = useLang();
  const { isAuthenticated, signInWithGoogle } = useAuth();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [sessionsOpen, setSessionsOpen] = useState(false);

  const refreshSessions = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await import('../auth/api').then((m) =>
        m.apiFetch<{ sessions: SessionListItem[] }>('/api/chat/sessions'),
      );
      setSessions(res.sessions);
    } catch (err) {
      console.warn('[chat] sessions list failed', err);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (open && isAuthenticated) refreshSessions();
  }, [open, isAuthenticated, refreshSessions]);

  const onSessionCreated = useCallback(
    (id: string) => {
      setSessionId(id);
      // Refresh sidebar list so the new session appears at the top.
      refreshSessions();
    },
    [refreshSessions],
  );

  const chat = useAgentChat({ lang, travelMode, sessionId, onSessionCreated });
  const [draft, setDraft] = useState('');
  const [snap, setSnap] = useState<Snap>('mid');
  const [attachments, setAttachments] = useState<AttachmentRef[]>([]);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startNewSession = useCallback(() => {
    chat.reset();
    setSessionId(null);
    setSessionsOpen(false);
  }, [chat]);

  const switchToSession = useCallback((id: string) => {
    setSessionId(id);
    setSessionsOpen(false);
  }, []);

  const deleteSession = useCallback(
    async (id: string) => {
      try {
        await import('../auth/api').then((m) =>
          m.apiFetch(`/api/chat/sessions/${id}`, { method: 'DELETE' }),
        );
        if (id === sessionId) {
          chat.reset();
          setSessionId(null);
        }
        setSessions((prev) => prev.filter((s) => s.id !== id));
      } catch (err) {
        console.warn('[chat] session delete failed', err);
      }
    },
    [chat, sessionId],
  );

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
    if ((!text && attachments.length === 0) || chat.isStreaming || uploadingCount > 0) return;
    chat.send(text, attachments);
    setDraft('');
    for (const a of attachments) URL.revokeObjectURL(a.previewUrl);
    setAttachments([]);
  }, [draft, attachments, chat, uploadingCount]);

  const handleStarter = useCallback((text: string) => {
    setDraft(text);
    inputRef.current?.focus();
  }, []);

  // Handle photo selection from the OS picker. Each file is uploaded
  // independently — failures don't block the others. Successful uploads
  // are appended to `attachments`.
  const handleFilesSelected = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadError(null);
    const list = Array.from(files).slice(0, 4 - attachments.length);
    if (list.length === 0) return;
    setUploadingCount((n) => n + list.length);
    for (const file of list) {
      const previewUrl = URL.createObjectURL(file);
      try {
        const fd = new FormData();
        fd.append('photo', file);
        const res = await fetch('/api/uploads/photo', {
          method: 'POST',
          credentials: 'include',
          body: fd,
        });
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          const code = errBody?.error || `HTTP ${res.status}`;
          // Translate the few cases the user can act on; everything else
          // bubbles up the raw code.
          const friendly =
            code === 'file_too_large'
              ? (lang === 'ru' ? 'фото слишком большое (>16 МБ)' : 'photo too large (>16 MB)')
              : code === 'unsupported_media_type'
                ? (lang === 'ru' ? 'формат не поддерживается (JPEG / PNG / WebP)' : 'unsupported format (JPEG / PNG / WebP)')
                : code;
          throw new Error(friendly);
        }
        const data = (await res.json()) as { photoId: string; url: string };
        // Use the local previewUrl so the thumbnail appears instantly without
        // a round-trip; we only need the photoId to send to the agent.
        setAttachments((prev) => [...prev, { photoId: data.photoId, previewUrl }]);
        setUploadError(null);
      } catch (err) {
        URL.revokeObjectURL(previewUrl);
        const msg = err instanceof Error ? err.message : 'upload_failed';
        setUploadError(msg);
      } finally {
        setUploadingCount((n) => n - 1);
      }
    }
  }, [attachments.length]);

  const removeAttachment = useCallback((photoId: string) => {
    setAttachments((prev) => {
      const target = prev.find((a) => a.photoId === photoId);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((a) => a.photoId !== photoId);
    });
  }, []);

  // Apply prefill / auto-send injections from App. We key on the injection
  // id so a brand-new injection always re-fires even with the same text.
  const lastPrefillId = useRef<string | null>(null);
  useEffect(() => {
    if (!composerPrefill || composerPrefill.id === lastPrefillId.current) return;
    lastPrefillId.current = composerPrefill.id;
    setDraft((prev) => (prev ? `${prev.replace(/\s+$/, '')} ${composerPrefill.text}` : composerPrefill.text));
    setSnap('full');
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [composerPrefill]);

  const lastAutoSendId = useRef<string | null>(null);
  useEffect(() => {
    if (!autoSend || autoSend.id === lastAutoSendId.current) return;
    lastAutoSendId.current = autoSend.id;
    if (chat.isStreaming) return;
    chat.send(autoSend.text, attachments.length > 0 ? attachments : undefined);
    for (const a of attachments) URL.revokeObjectURL(a.previewUrl);
    setAttachments([]);
  }, [autoSend, chat, attachments]);

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
  // While dragging on mobile we override transform inline. Otherwise the
  // Tailwind responsive class below (`translate-y-full` on mobile,
  // `translate-x-full` on desktop) controls the closed-state direction.
  const dragInlineTransform = dragOffset !== 0 ? `translate3d(0, ${dragOffset}px, 0)` : undefined;

  const starters = T.starters[lang];
  const hasMessages = chat.messages.length > 0;

  return (
    <>
      <aside
        ref={sheetRef}
        role="dialog"
        aria-modal="false"
        aria-label={T.title[lang]}
        aria-hidden={!open}
        className={[
          'fixed z-40 will-change-transform select-none',
          'bg-ink-900/95 backdrop-blur-md text-ink-100',
          'shadow-sheet',
          // Mobile bottom sheet (height comes from CSS var `--sheet-h`)
          'inset-x-0 bottom-0 h-[var(--sheet-h)] rounded-t-[20px] border-t border-ink-700/60',
          // Desktop right drawer (full height, fixed width on the right)
          'md:inset-x-auto md:top-0 md:right-0 md:h-[100svh] md:w-[440px] md:rounded-none md:border-l md:border-t-0 md:border-ink-700/60',
          // Closed states differ by direction. On mobile the sheet slides
          // down (translateY); on desktop the drawer slides right (translateX).
          open
            ? 'translate-y-0 md:translate-x-0'
            : 'translate-y-full pointer-events-none md:translate-y-0 md:translate-x-full',
          'transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]',
        ].join(' ')}
        style={{
          // svh (small viewport) so the sheet always fits even when the iOS
          // Safari URL bar is showing. Top edge is fine; bottom-pinned + svh
          // means the composer stays above the browser chrome.
          ['--sheet-h' as never]: `min(${mobileHeightDvh}svh, 92svh)`,
          transform: dragInlineTransform,
          paddingBottom: 'max(env(safe-area-inset-bottom), 8px)',
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
              <button
                type="button"
                onClick={() => setSessionsOpen((v) => !v)}
                title={lang === 'ru' ? 'Чаты' : 'Chats'}
                aria-label={lang === 'ru' ? 'Чаты' : 'Chats'}
                className={[
                  'grid h-9 w-9 place-items-center rounded-full transition-colors',
                  sessionsOpen
                    ? 'bg-ink-800 text-ink-100'
                    : 'text-ink-300 hover:bg-ink-800 hover:text-ink-100',
                ].join(' ')}
              >
                <IconList />
              </button>
              {hasMessages && (
                <button
                  type="button"
                  onClick={startNewSession}
                  title={T.newChat[lang]}
                  aria-label={T.newChat[lang]}
                  className="grid h-9 w-9 place-items-center rounded-full text-ink-300 transition-colors hover:bg-ink-800 hover:text-ink-100"
                >
                  <IconPlus />
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

          {/* — Sessions overlay — */}
          {sessionsOpen && isAuthenticated && (
            <SessionsOverlay
              lang={lang}
              sessions={sessions}
              activeId={sessionId}
              onPick={switchToSession}
              onNew={startNewSession}
              onDelete={deleteSession}
              onClose={() => setSessionsOpen(false)}
            />
          )}

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
                            travelMode={travelMode}
                            onTravelModeChange={onTravelModeChange}
                            activeRouteSig={activeRouteSig}
                            onActivateRoute={onActivateRoute}
                            isLastMessage={m.id === chat.messages[chat.messages.length - 1]?.id}
                            isStreaming={chat.isStreaming}
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

                {(attachments.length > 0 || uploadingCount > 0 || uploadError) && (
                  <AttachmentTray
                    items={attachments}
                    uploadingCount={uploadingCount}
                    error={uploadError}
                    lang={lang}
                    onRemove={removeAttachment}
                  />
                )}

                <div className="flex items-end gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      handleFilesSelected(e.target.files);
                      // reset so picking the same file twice fires onChange
                      e.target.value = '';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={attachments.length >= 4}
                    title={lang === 'ru' ? 'Прикрепить фото' : 'Attach photo'}
                    aria-label={lang === 'ru' ? 'Прикрепить фото' : 'Attach photo'}
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink-300 transition-colors hover:bg-ink-800 hover:text-ink-100 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <IconPaperclip />
                  </button>
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
                      disabled={(!draft.trim() && attachments.length === 0) || uploadingCount > 0}
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

function AttachmentTray({
  items,
  uploadingCount,
  error,
  lang,
  onRemove,
}: {
  items: AttachmentRef[];
  uploadingCount: number;
  error: string | null;
  lang: 'ru' | 'en';
  onRemove: (photoId: string) => void;
}) {
  return (
    <div className="mb-2 flex flex-col gap-1">
      <div className="flex flex-wrap gap-1.5">
        {items.map((a) => (
          <div
            key={a.photoId}
            className="relative h-14 w-14 overflow-hidden rounded-lg border border-ink-700/60 bg-ink-950"
          >
            <img src={a.previewUrl} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onRemove(a.photoId)}
              aria-label={lang === 'ru' ? 'Убрать' : 'Remove'}
              className="absolute right-0.5 top-0.5 grid h-4 w-4 place-items-center rounded-full bg-ink-950/80 text-[10px] text-ink-100 hover:bg-rose-500/90"
            >
              ×
            </button>
          </div>
        ))}
        {Array.from({ length: uploadingCount }).map((_, i) => (
          <div
            key={`u-${i}`}
            className="grid h-14 w-14 animate-pulse place-items-center rounded-lg border border-ink-700/60 bg-ink-900 text-[10px] text-ink-400"
            aria-label={lang === 'ru' ? 'Загружаю…' : 'Uploading…'}
          >
            …
          </div>
        ))}
      </div>
      {error && (
        <p className="text-[11px] text-rose-300/80">
          {lang === 'ru' ? 'Ошибка загрузки' : 'Upload error'}: {error}
        </p>
      )}
    </div>
  );
}

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
  travelMode,
  onTravelModeChange,
  activeRouteSig,
  onActivateRoute,
  isLastMessage,
  isStreaming,
}: {
  message: AgentMessage;
  lang: 'ru' | 'en';
  onSelectCard: (slug: string) => void;
  onMapCard: (slug: string) => void;
  travelMode: TravelMode;
  onTravelModeChange: (m: TravelMode) => void;
  activeRouteSig: string | null;
  onActivateRoute: (sig: string, data: RouteCardData) => void;
  isLastMessage: boolean;
  isStreaming: boolean;
}) {
  const items = message.items;

  // The streaming caret is shown on the last text item of the last assistant
  // message that is still streaming.
  const lastTextIdx = (() => {
    for (let i = items.length - 1; i >= 0; i--) {
      if (items[i]!.kind === 'text') return i;
    }
    return -1;
  })();
  const caretAt = isLastMessage && isStreaming ? lastTextIdx : -1;

  return (
    <div className="flex flex-col gap-3">
      {items.map((item, idx) => {
        if (item.kind === 'text') {
          return (
            <div
              key={idx}
              className="text-[14px] leading-relaxed text-ink-100 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
            >
              {renderMarkdown(item.value)}
              {idx === caretAt && (
                <span
                  aria-hidden
                  className="ml-0.5 inline-block h-[14px] w-[2px] -translate-y-[1px] animate-caret bg-accent"
                  style={{ verticalAlign: 'text-bottom' }}
                />
              )}
            </div>
          );
        }
        if (item.kind === 'tool') {
          return (
            <div key={idx} className="text-[12px] italic text-ink-500">
              {item.label}
              {item.count > 1 && (
                <span className="ml-1.5 rounded bg-ink-800/60 px-1.5 py-[1px] not-italic text-[10.5px] tabular-nums text-ink-300">
                  ×{item.count}
                </span>
              )}
            </div>
          );
        }
        if (item.kind === 'cards') {
          return (
            <ul key={idx} className="flex flex-col gap-2">
              {item.items.map((c) => (
                <CardRow
                  key={`${message.id}-${idx}-${c.slug}`}
                  card={c}
                  lang={lang}
                  onSelect={onSelectCard}
                  onMap={onMapCard}
                />
              ))}
            </ul>
          );
        }
        if (item.kind === 'route') {
          return (
            <RouteCard
              key={idx}
              route={item.data}
              sig={item.sig}
              isActive={activeRouteSig === item.sig}
              lang={lang}
              onSelectStop={onSelectCard}
              onActivate={() => onActivateRoute(item.sig, item.data)}
              travelMode={travelMode}
              onTravelModeChange={onTravelModeChange}
            />
          );
        }
        return null;
      })}

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

// ─── RouteCard ──────────────────────────────────────────────────────

const DAY_COLORS = ['#ff6a3d', '#0ea5e9', '#a855f7', '#10b981', '#f59e0b'];

function RouteCard({
  route,
  sig,
  isActive,
  lang,
  onSelectStop,
  onActivate,
  travelMode,
  onTravelModeChange,
}: {
  route: RouteCardData;
  sig: string;
  isActive: boolean;
  lang: 'ru' | 'en';
  onSelectStop: (slug: string) => void;
  onActivate: () => void;
  travelMode: TravelMode;
  onTravelModeChange: (m: TravelMode) => void;
}) {
  const directions = useRouteDirections();
  const { byId } = useAttractions();
  let counter = 0;
  void sig;
  return (
    <div
      className={[
        'overflow-hidden rounded-[14px] border bg-ink-950/55 transition-colors',
        isActive ? 'border-accent/65 shadow-[inset_0_0_0_1px_rgba(255,106,61,0.35)]' : 'border-ink-700/55',
      ].join(' ')}
    >
      <header className="flex items-center justify-between gap-3 border-b border-ink-700/40 bg-ink-900/40 px-3 py-2">
        <div className="min-w-0 flex items-center gap-2">
          <span aria-hidden className="text-[14px]">🚗</span>
          <span className="truncate text-[12px] font-semibold tracking-wide text-ink-100">
            {route.title || (lang === 'ru' ? 'Маршрут' : 'Route')}
          </span>
        </div>
        {isActive ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-[1px] text-[10.5px] font-medium uppercase tracking-[0.18em] text-accent">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />
            {directions.isLoading
              ? lang === 'ru' ? 'считаю…' : 'computing…'
              : lang === 'ru' ? 'на карте' : 'on map'}
          </span>
        ) : (
          <button
            type="button"
            onClick={onActivate}
            className="inline-flex items-center gap-1 rounded-full border border-ink-700/60 px-2 py-[1px] text-[10.5px] font-medium uppercase tracking-[0.18em] text-ink-300 transition-colors hover:border-accent/50 hover:text-accent"
          >
            {lang === 'ru' ? 'на карту' : 'show map'}
          </button>
        )}
      </header>

      {/* Travel mode segmented control */}
      <div className="flex items-stretch gap-1 px-2 pt-2">
        {TRAVEL_MODE_ORDER.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onTravelModeChange(m)}
            className={[
              'flex-1 rounded-full px-2 py-1.5 text-[11.5px] font-medium transition-colors',
              m === travelMode
                ? 'bg-accent text-ink-950'
                : 'border border-ink-700/55 text-ink-300 hover:border-accent/40 hover:text-ink-100',
            ].join(' ')}
          >
            <span className="mr-1" aria-hidden>{TRAVEL_MODE_ICON[m]}</span>
            {TRAVEL_MODE_LABEL[m][lang]}
          </button>
        ))}
      </div>

      {directions.error && (
        <p className="px-3 pt-1 text-[11px] italic text-rose-300/80">{directions.error}</p>
      )}

      <ol className="flex flex-col">
        {route.days.map((day, dayIdx) => {
          const color = DAY_COLORS[dayIdx % DAY_COLORS.length] ?? '#ff6a3d';
          return (
            <li key={dayIdx} className="border-b border-ink-700/30 last:border-b-0">
              <div className="flex items-center gap-2 px-3 pt-2.5 pb-1.5">
                <span
                  aria-hidden
                  className="h-1.5 w-6 rounded-full"
                  style={{ background: color }}
                />
                <span className="flex-1 truncate text-[13px] font-semibold text-ink-100">
                  {day.title}
                </span>
                <a
                  href={buildGoogleMapsDirUrl(day, byId, travelMode)}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={lang === 'ru' ? 'Открыть в Google Maps' : 'Open in Google Maps'}
                  aria-label={lang === 'ru' ? 'Открыть в Google Maps' : 'Open in Google Maps'}
                  className="inline-flex items-center gap-1 rounded-full border border-ink-700/55 px-2 py-[2px] text-[10.5px] font-medium text-ink-300 transition-colors hover:border-accent/55 hover:text-accent"
                >
                  <IconExternal />
                  Maps
                </a>
              </div>
              <ul className="px-3 pb-2.5">
                {day.stops.map((stop, idx) => {
                  const n = ++counter;
                  // Live leg from the directions context (real Google route);
                  // fall back to the agent's haversine estimate.
                  const liveLeg = idx > 0 ? findLeg(directions.legs, dayIdx, idx) : undefined;
                  const minutes = liveLeg?.minutes ?? stop.drive_minutes_from_prev ?? null;
                  const isApprox = liveLeg == null;
                  return (
                    <li key={`${dayIdx}-${idx}-${stop.slug}`} className="relative pl-7">
                      <span
                        aria-hidden
                        className="absolute left-[10px] top-0 h-full w-px"
                        style={{ background: idx === day.stops.length - 1 ? 'transparent' : color, opacity: 0.4 }}
                      />
                      <button
                        type="button"
                        onClick={() => onSelectStop(stop.slug)}
                        className="group flex w-full items-start gap-2 py-1.5 text-left"
                      >
                        <span
                          className="absolute left-0 top-2 grid h-[22px] w-[22px] place-items-center rounded-full text-[11px] font-bold tabular-nums text-ink-950 shadow"
                          style={{ background: color, fontWeight: 700 }}
                        >
                          {n}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-2">
                            <span className="truncate text-[13.5px] font-medium text-ink-100 group-hover:text-accent">
                              {stop.name}
                            </span>
                            {stop.arrive_at && (
                              <span className="ml-auto shrink-0 text-[11px] tabular-nums text-ink-500">
                                {stop.arrive_at}
                              </span>
                            )}
                          </div>
                          {stop.note && (
                            <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-ink-300">
                              {stop.note}
                            </p>
                          )}
                          {idx > 0 && minutes != null && (
                            <p className="mt-0.5 text-[11px] italic text-ink-500 tabular-nums">
                              {isApprox ? '≈ ' : ''}
                              {minutes} {lang === 'ru' ? 'мин' : 'min'}
                              {liveLeg && liveLeg.meters > 0 && (
                                <> · {(liveLeg.meters / 1000).toFixed(liveLeg.meters > 9999 ? 0 : 1)} km</>
                              )}
                            </p>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

const TRAVEL_MODE_ICON: Record<TravelMode, string> = {
  DRIVING: '🚗',
  WALKING: '🚶',
  BICYCLING: '🚲',
  TRANSIT: '🚌',
};

const TRAVEL_MODE_GMAPS: Record<TravelMode, string> = {
  DRIVING: 'driving',
  WALKING: 'walking',
  BICYCLING: 'bicycling',
  TRANSIT: 'transit',
};

// Build a Google Maps "directions" deeplink for one route day.
// https://developers.google.com/maps/documentation/urls/get-started#directions-action
//
// Up to 9 waypoints between origin and destination (free-tier limit). When
// the day has more stops, we keep origin + destination and shrink the
// waypoint list down — this matches what Google Maps would do anyway.
function buildGoogleMapsDirUrl(
  day: RouteCardData['days'][number],
  byId: ReadonlyMap<string, import('../types').Attraction>,
  travelMode: TravelMode,
): string {
  const stops = day.stops
    .map((s) => byId.get(s.slug)?.coordinates)
    .filter((c): c is { lat: number; lng: number } => !!c);
  if (stops.length === 0) return 'https://maps.google.com/';
  const fmt = (c: { lat: number; lng: number }) => `${c.lat},${c.lng}`;
  const origin = stops[0]!;
  const destination = stops[stops.length - 1] ?? origin;
  const middle = stops.slice(1, -1);
  // Cap waypoints at 9 (free-tier Google Maps URL limit).
  const trimmed = middle.length > 9 ? middle.slice(0, 9) : middle;
  const params = new URLSearchParams({
    api: '1',
    origin: fmt(origin),
    destination: fmt(destination),
    travelmode: TRAVEL_MODE_GMAPS[travelMode],
  });
  if (trimmed.length > 0) {
    params.set('waypoints', trimmed.map(fmt).join('|'));
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function IconExternal() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M14 5h5v5M19 5L10 14M5 9v10h10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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

function SessionsOverlay({
  lang,
  sessions,
  activeId,
  onPick,
  onNew,
  onDelete,
  onClose,
}: {
  lang: 'ru' | 'en';
  sessions: SessionListItem[];
  activeId: string | null;
  onPick: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-ink-900/98 backdrop-blur-md">
      <div className="flex items-center justify-between gap-2 border-b border-ink-700/40 px-5 py-3">
        <h3 className="text-[15px] font-semibold text-ink-100">
          {lang === 'ru' ? 'Чаты' : 'Chats'}
        </h3>
        <button
          type="button"
          onClick={onClose}
          aria-label={lang === 'ru' ? 'Закрыть' : 'Close'}
          className="grid h-8 w-8 place-items-center rounded-full text-ink-300 hover:bg-ink-800 hover:text-ink-100"
        >
          <IconClose />
        </button>
      </div>

      <button
        type="button"
        onClick={onNew}
        className="mx-3 mt-3 inline-flex items-center justify-center gap-1.5 rounded-full bg-accent px-4 py-2 text-[13px] font-semibold text-ink-950 transition-opacity hover:opacity-90"
      >
        <IconPlus />
        {lang === 'ru' ? 'Новый чат' : 'New chat'}
      </button>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {sessions.length === 0 ? (
          <p className="px-2 text-[13px] text-ink-500">
            {lang === 'ru' ? 'Пока нет сохранённых чатов.' : 'No saved chats yet.'}
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {sessions.map((s) => {
              const isActive = s.id === activeId;
              return (
                <li key={s.id}>
                  <div
                    className={[
                      'group flex items-stretch overflow-hidden rounded-xl border transition-colors',
                      isActive
                        ? 'border-accent/55 bg-accent/10'
                        : 'border-ink-700/45 bg-ink-950/35 hover:border-ink-500/55',
                    ].join(' ')}
                  >
                    <button
                      type="button"
                      onClick={() => onPick(s.id)}
                      className="flex flex-1 flex-col items-start gap-0.5 px-3 py-2 text-left"
                    >
                      <span className="line-clamp-1 text-[13.5px] font-medium text-ink-100">
                        {s.title}
                      </span>
                      {s.preview && (
                        <span className="line-clamp-1 text-[11.5px] text-ink-500">
                          {s.preview}
                        </span>
                      )}
                      <span className="text-[10.5px] uppercase tracking-[0.16em] text-ink-500/80">
                        {formatRelative(s.updatedAt, lang)}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(s.id)}
                      title={lang === 'ru' ? 'Удалить' : 'Delete'}
                      aria-label={lang === 'ru' ? 'Удалить' : 'Delete'}
                      className="grid w-10 shrink-0 place-items-center text-ink-500 opacity-0 transition-opacity hover:bg-ink-800/60 hover:text-rose-300 group-hover:opacity-100"
                    >
                      <IconTrash />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function formatRelative(iso: string, lang: 'ru' | 'en'): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const diffMin = Math.round((Date.now() - t) / 60_000);
  if (diffMin < 1) return lang === 'ru' ? 'только что' : 'just now';
  if (diffMin < 60) return lang === 'ru' ? `${diffMin} мин` : `${diffMin} min`;
  const h = Math.round(diffMin / 60);
  if (h < 24) return lang === 'ru' ? `${h} ч` : `${h}h`;
  const d = Math.round(h / 24);
  if (d < 30) return lang === 'ru' ? `${d} дн` : `${d}d`;
  return new Date(iso).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-GB', {
    day: 'numeric',
    month: 'short',
  });
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
function IconList() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 7h16M4 12h16M4 17h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function IconPlus() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function IconTrash() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 7h14M10 11v6M14 11v6M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2"
        stroke="currentColor"
        strokeWidth="1.6"
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
function IconPaperclip() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M21 11.5l-9.2 9.2a5.5 5.5 0 11-7.78-7.78l9.2-9.2a3.7 3.7 0 015.23 5.23l-9.2 9.2a1.85 1.85 0 11-2.62-2.62l8.5-8.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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
