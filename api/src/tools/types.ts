// What the LLM gets back (`forModel`) and what the frontend should render
// (`uiEvents`) per tool invocation. Multiple uiEvents per tool call are fine.

export interface UiEventCardAttractions {
  type: 'cards.attractions';
  items: Array<{
    slug: string;
    name: string;
    short: string;
    category: string;
    score?: number;
  }>;
}

export interface UiEventShowOnMap {
  type: 'map.show';
  slugs: string[];
  flyTo?: { lat: number; lng: number; zoom?: number };
}

export interface UiEventOpenDrawer {
  type: 'drawer.open';
  slug: string;
}

export interface RouteStop {
  slug: string;
  name: string;
  arrive_at?: string | null;
  drive_minutes_from_prev?: number | null;
  note?: string | null;
}

export interface RouteDay {
  title: string;
  stops: RouteStop[];
}

export interface UiEventRouteShow {
  type: 'route.show';
  title?: string;
  days: RouteDay[];
}

export type UiEvent =
  | UiEventCardAttractions
  | UiEventShowOnMap
  | UiEventOpenDrawer
  | UiEventRouteShow;

export interface ToolResult {
  forModel: unknown;
  uiEvents?: UiEvent[];
}
