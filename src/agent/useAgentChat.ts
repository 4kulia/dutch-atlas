import { useCallback, useRef, useState } from 'react';
import { agentBus } from './events';

export interface CardItem {
  slug: string;
  name: string;
  short: string;
  category: string;
  score?: number;
}

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  cards?: CardItem[];
  toolHints?: string[];   // ephemeral "🔍 searching…" notes
  isStreaming?: boolean;
}

interface State {
  messages: AgentMessage[];
  isStreaming: boolean;
  error: string | null;
}

export function useAgentChat(lang: 'ru' | 'en') {
  const [state, setState] = useState<State>({ messages: [], isStreaming: false, error: null });
  const abortRef = useRef<AbortController | null>(null);

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
      };
      const assistantMsg: AgentMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: '',
        isStreaming: true,
      };
      const history = state.messages.map((m) => ({ role: m.role, content: m.text }));

      setState((prev) => ({
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
          body: JSON.stringify({ message: trimmed, lang, history }),
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
          messages: prev.messages.map((m) =>
            m.id === assistantMsg.id ? { ...m, isStreaming: false } : m,
          ),
          isStreaming: false,
        }));
        abortRef.current = null;
      }
    },
    [lang, state.isStreaming, state.messages],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState({ messages: [], isStreaming: false, error: null });
  }, []);

  return { ...state, send, stop, reset };
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
      messages: prev.messages.map((m) =>
        m.id === assistantId ? { ...m, text: m.text + payload.delta } : m,
      ),
    }));
    return;
  }
  if (evt === 'tool') {
    const name = String(payload?.name ?? '');
    const hint = TOOL_HINTS[name] ?? `…${name}`;
    setState((prev) => ({
      ...prev,
      messages: prev.messages.map((m) =>
        m.id === assistantId
          ? { ...m, toolHints: [...(m.toolHints ?? []), hint] }
          : m,
      ),
    }));
    return;
  }
  if (evt === 'ui') {
    if (payload?.type === 'cards.attractions' && Array.isArray(payload.items)) {
      setState((prev) => ({
        ...prev,
        messages: prev.messages.map((m) =>
          m.id === assistantId
            ? { ...m, cards: [...(m.cards ?? []), ...payload.items] }
            : m,
        ),
      }));
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
};
