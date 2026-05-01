import { useCallback, useEffect, useRef, useState } from 'react';
import { agentBus, type AgentRouteShow } from './events';
import { apiFetch } from '../auth/api';
import type { TravelMode } from './travelMode';

export interface CardItem {
  slug: string;
  name: string;
  short: string;
  category: string;
  score?: number;
}

export interface RouteCardData {
  title?: string;
  days: Array<{
    title: string;
    stops: Array<{
      slug: string;
      name: string;
      arrive_at?: string | null;
      drive_minutes_from_prev?: number | null;
      note?: string | null;
    }>;
  }>;
}

// One assistant turn is a *timeline* of items rendered in arrival order.
// This preserves the natural sequence of `text → tool call → cards → text → route`
// instead of bucketising everything into separate sections.
export type TimelineItem =
  | { kind: 'text'; value: string }
  | { kind: 'tool'; label: string; count: number }
  | { kind: 'cards'; items: CardItem[] }
  | { kind: 'route'; data: RouteCardData; sig: string };

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;          // for user messages and as a flat copy for history
  items: TimelineItem[]; // for assistant messages
  isStreaming?: boolean;
}

interface State {
  messages: AgentMessage[];
  isStreaming: boolean;
  error: string | null;
  sessionId: string | null;
}

interface ApiSessionMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  uiEvents: unknown[];
  createdAt: string;
}

interface UseAgentChatOpts {
  lang: 'ru' | 'en';
  travelMode: TravelMode;
  sessionId: string | null;
  onSessionCreated?: (sessionId: string) => void;
}

export function useAgentChat({ lang, travelMode, sessionId, onSessionCreated }: UseAgentChatOpts) {
  const [state, setState] = useState<State>({
    messages: [],
    isStreaming: false,
    error: null,
    sessionId: null,
  });
  const abortRef = useRef<AbortController | null>(null);

  // We track the session id we own internally so we can ignore prop changes
  // that simply echo back what we just told the parent (e.g. the agent
  // reported `sessionFresh=true` and we called onSessionCreated, which
  // bumped the parent's prop to that same id).
  const internalSidRef = useRef<string | null>(null);
  useEffect(() => {
    internalSidRef.current = state.sessionId;
  });

  // When the active session changes from the OUTSIDE (user picks another
  // chat), hydrate from the server. Skip when the prop simply matches what
  // we already have internally — that would clobber a stream in progress.
  useEffect(() => {
    if (!sessionId) {
      setState({ messages: [], isStreaming: false, error: null, sessionId: null });
      return;
    }
    if (internalSidRef.current === sessionId) return;
    let cancelled = false;
    apiFetch<{ session: { id: string }; messages: ApiSessionMessage[] }>(`/api/chat/sessions/${sessionId}`)
      .then((res) => {
        if (cancelled) return;
        const messages: AgentMessage[] = res.messages.map((m) =>
          m.role === 'user'
            ? { id: m.id, role: 'user', text: m.content, items: [] }
            : {
                id: m.id,
                role: 'assistant',
                text: m.content,
                items: rebuildAssistantTimeline(m.content, Array.isArray(m.uiEvents) ? m.uiEvents : []),
              },
        );
        setState({ messages, isStreaming: false, error: null, sessionId: res.session.id });
        // Re-emit the *last* route in this conversation so the map reflects
        // the active state when the user comes back to a session.
        for (let i = messages.length - 1; i >= 0; i--) {
          const route = messages[i]!.items.find((it): it is Extract<TimelineItem, { kind: 'route' }> => it.kind === 'route');
          if (route) {
            agentBus.emit({ type: 'route.show', title: route.data.title, days: route.data.days, sig: route.sig });
            break;
          }
        }
      })
      .catch((err) => {
        if (!cancelled) console.warn('[chat] session load failed', err);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || state.isStreaming) return;

      const ac = new AbortController();
      abortRef.current = ac;

      const userMsg: AgentMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        text: trimmed,
        items: [],
      };
      const assistantMsg: AgentMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: '',
        items: [],
        isStreaming: true,
      };
      // Reduce assistant turns to flat text for the API history — the model
      // doesn't need its own tool_use blocks back, just the surfaced text.
      const history = state.messages.map((m) => ({
        role: m.role,
        content: m.role === 'user' ? m.text : flattenAssistant(m),
      }));

      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, userMsg, assistantMsg],
        isStreaming: true,
        error: null,
      }));

      let res: Response;
      try {
        res = await fetch('/api/agent/messages', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: trimmed,
            lang,
            travelMode,
            sessionId: state.sessionId,
            history,
          }),
          signal: ac.signal,
        });
      } catch (err) {
        if (ac.signal.aborted) return;
        const msg = err instanceof Error ? err.message : 'network error';
        setState((prev) => ({ ...prev, isStreaming: false, error: msg }));
        return;
      }

      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => '');
        let label = `HTTP ${res.status}`;
        try {
          const j = JSON.parse(text);
          if (j?.error) label = String(j.error);
        } catch {
          /* ignore */
        }
        setState((prev) => ({ ...prev, isStreaming: false, error: label }));
        return;
      }

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const chunks = buf.split('\n\n');
          buf = chunks.pop() ?? '';
          for (const chunk of chunks) {
            const lines = chunk.split('\n');
            const evt = lines.find((l) => l.startsWith('event: '))?.slice(7).trim();
            const data = lines.find((l) => l.startsWith('data: '))?.slice(6);
            if (!evt || !data) continue;
            const payload = (() => {
              try {
                return JSON.parse(data);
              } catch {
                return null;
              }
            })();
            if (!payload) continue;
            if (evt === 'start' && typeof payload?.sessionId === 'string') {
              const newSid: string = payload.sessionId;
              setState((prev) => ({ ...prev, sessionId: newSid }));
              if (payload?.sessionFresh && onSessionCreated) {
                onSessionCreated(newSid);
              }
              continue;
            }
            handleEvent(evt, payload, assistantMsg.id, setState);
          }
        }
      } catch (err) {
        if (!ac.signal.aborted) {
          const msg = err instanceof Error ? err.message : 'stream failed';
          setState((prev) => ({ ...prev, isStreaming: false, error: msg }));
        }
      } finally {
        setState((prev) => ({
          ...prev,
          messages: prev.messages.map((m) => {
            if (m.id !== assistantMsg.id) return m;
            const flat = flattenAssistant(m);
            return { ...m, isStreaming: false, text: flat };
          }),
          isStreaming: false,
        }));
        abortRef.current = null;
      }
    },
    [lang, travelMode, state.isStreaming, state.messages, state.sessionId, onSessionCreated],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState({ messages: [], isStreaming: false, error: null, sessionId: null });
  }, []);

  return { ...state, send, stop, reset };
}

// When loading a stored session we don't have the original streaming order
// of text vs tool vs ui events, but we DO have the final reply text and
// the recorded ui events. Reconstruct a viewable timeline:
//   1. text (the model's final reply)
//   2. cards + route from recorded ui events, in their saved order.
// Tool hints are dropped — they were ephemeral progress indicators.
export function rebuildAssistantTimeline(text: string, uiEvents: unknown[]): TimelineItem[] {
  const items: TimelineItem[] = [];
  if (text && text.trim().length > 0) items.push({ kind: 'text', value: text });
  const seenSlugs = new Set<string>();
  for (const raw of uiEvents) {
    const ev = raw as { type?: string; items?: CardItem[]; title?: string; days?: AgentRouteShow['days']; sig?: string };
    if (ev?.type === 'cards.attractions' && Array.isArray(ev.items)) {
      const fresh = ev.items.filter((c) => !seenSlugs.has(c.slug));
      for (const c of fresh) seenSlugs.add(c.slug);
      if (fresh.length > 0) items.push({ kind: 'cards', items: fresh });
    } else if (ev?.type === 'route.show' && Array.isArray(ev.days)) {
      const sig = ev.sig ?? crypto.randomUUID();
      items.push({
        kind: 'route',
        sig,
        data: { title: ev.title, days: ev.days as RouteCardData['days'] },
      });
    }
  }
  return items;
}

function flattenAssistant(m: AgentMessage): string {
  // Concatenate the visible text from text items only — tool hints and
  // structured artefacts (cards, route) are reconstructed by the model
  // from search results in the next turn, not from prose.
  return m.items
    .filter((i): i is Extract<TimelineItem, { kind: 'text' }> => i.kind === 'text')
    .map((i) => i.value)
    .join('')
    .trim();
}

function handleEvent(
  evt: string,
  payload: any,
  assistantId: string,
  setState: React.Dispatch<React.SetStateAction<State>>,
): void {
  if (evt === 'text' && typeof payload?.delta === 'string') {
    setState((prev) => ({
      ...prev,
      messages: prev.messages.map((m) => {
        if (m.id !== assistantId) return m;
        const items = m.items.slice();
        const last = items[items.length - 1];
        if (last && last.kind === 'text') {
          items[items.length - 1] = { ...last, value: last.value + payload.delta };
        } else {
          items.push({ kind: 'text', value: payload.delta });
        }
        return { ...m, items };
      }),
    }));
    return;
  }

  if (evt === 'tool') {
    const name = String(payload?.name ?? '');
    const label = TOOL_HINTS[name] ?? `…${name}`;
    setState((prev) => ({
      ...prev,
      messages: prev.messages.map((m) => {
        if (m.id !== assistantId) return m;
        const items = m.items.slice();
        const last = items[items.length - 1];
        // Collapse consecutive identical tool hints — e.g. agent looking up
        // 7 places in a row should show "📖 читаю описание ×7", not 7 lines.
        if (last && last.kind === 'tool' && last.label === label) {
          items[items.length - 1] = { ...last, count: last.count + 1 };
        } else {
          items.push({ kind: 'tool', label, count: 1 });
        }
        return { ...m, items };
      }),
    }));
    return;
  }

  if (evt === 'ui') {
    if (payload?.type === 'cards.attractions' && Array.isArray(payload.items)) {
      setState((prev) => ({
        ...prev,
        messages: prev.messages.map((m) => {
          if (m.id !== assistantId) return m;
          // Dedup against everything previously surfaced in this turn — when
          // the model runs search_attractions twice with overlapping results
          // we don't want to repeat cards.
          const seen = new Set<string>();
          for (const it of m.items) {
            if (it.kind === 'cards') for (const c of it.items) seen.add(c.slug);
          }
          const fresh = (payload.items as CardItem[]).filter((c) => !seen.has(c.slug));
          if (fresh.length === 0) return m;
          return { ...m, items: [...m.items, { kind: 'cards', items: fresh }] };
        }),
      }));
      return;
    }
    if (payload?.type === 'route.show') {
      const sig = crypto.randomUUID();
      const data: RouteCardData = { title: payload.title, days: payload.days };
      setState((prev) => ({
        ...prev,
        messages: prev.messages.map((m) => {
          if (m.id !== assistantId) return m;
          return { ...m, items: [...m.items, { kind: 'route', data, sig }] };
        }),
      }));
      // Tell App to activate this route on the map.
      agentBus.emit({ type: 'route.show', title: payload.title, days: payload.days, sig } as any);
      return;
    }
    if (payload?.type === 'map.show' || payload?.type === 'drawer.open') {
      agentBus.emit(payload);
    }
    return;
  }

  if (evt === 'error') {
    setState((prev) => ({ ...prev, error: String(payload?.message ?? 'agent error') }));
  }
}

const TOOL_HINTS: Record<string, string> = {
  search_attractions: '🔍 ищу подходящие места…',
  get_attraction_details: '📖 читаю описание…',
  show_on_map: '🗺 показываю на карте…',
  open_drawer: '➡ открываю детали…',
  build_route: '🚗 собираю маршрут…',
};
