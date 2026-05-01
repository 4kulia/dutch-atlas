// Event bus that connects the chat panel to the rest of the UI (map +
// drawer). The chat-panel is the only emitter; MapView and App.tsx are
// the listeners. We avoid lifting state into App because the chat would
// otherwise have to thread props through too many layers.

export interface AgentMapShow {
  type: 'map.show';
  slugs: string[];
  flyTo?: { lat: number; lng: number; zoom?: number };
}

export interface AgentDrawerOpen {
  type: 'drawer.open';
  slug: string;
}

export type AgentUiEvent = AgentMapShow | AgentDrawerOpen;

type Listener = (event: AgentUiEvent) => void;

class AgentBus {
  private listeners = new Set<Listener>();

  emit(event: AgentUiEvent) {
    for (const fn of this.listeners) {
      try {
        fn(event);
      } catch (err) {
        console.error('[agent-bus] listener threw', err);
      }
    }
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}

export const agentBus = new AgentBus();
