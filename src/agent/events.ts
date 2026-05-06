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

export interface RouteStop {
  slug: string;
  name?: string;
  arrive_at?: string | null;
  drive_minutes_from_prev?: number | null;
  note?: string | null;
}

export interface RouteDay {
  title: string;
  stops: RouteStop[];
}

export interface AgentRouteShow {
  type: 'route.show';
  title?: string;
  days: RouteDay[];
  sig?: string;
}

// User-add flow: the agent asks the user to drop a pin on the map. The
// app switches MapView into "picking" mode and emits the chosen coords
// back via chat.send with a `[picked_lat=…, picked_lng=…]` prefix.
export interface AgentMapPickPoint {
  type: 'map.pickPoint';
  prompt?: string;
}

// Notification that save_place_draft just persisted a new place. The new
// row will appear via the attractions API; this event just lets the UI
// refresh "my places" / catalogue.
export interface AgentDraftSaved {
  type: 'draft.saved';
  slug: string;
  status: 'draft' | 'pending';
}

export type AgentUiEvent =
  | AgentMapShow
  | AgentDrawerOpen
  | AgentRouteShow
  | AgentMapPickPoint
  | AgentDraftSaved;

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
