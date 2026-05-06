import type { ToolResult } from './types.js';

// Side-effect tools — they push UI events to the browser via SSE. The
// model's "data" return is a tiny ack (`{ok:true}`); the real work is
// the UiEvent dispatched to the frontend.

export const showOnMapToolDef = {
  name: 'show_on_map',
  description:
    'Highlight a set of attractions on the map by slug, optionally panning the viewport to fit them. ' +
    'Use after presenting recommendations so the user sees their locations at a glance. Pass at most 12 slugs.',
  input_schema: {
    type: 'object',
    properties: {
      slugs: { type: 'array', items: { type: 'string' }, maxItems: 12 },
      fly_to: {
        type: 'object',
        properties: {
          lat: { type: 'number' },
          lng: { type: 'number' },
          zoom: { type: 'number' },
        },
        required: ['lat', 'lng'],
      },
    },
    required: ['slugs'],
  },
} as const;

interface ShowArgs {
  slugs: string[];
  fly_to?: { lat: number; lng: number; zoom?: number };
}

export async function showOnMap(args: ShowArgs, _ctx: { userId: string }): Promise<ToolResult> {
  return {
    forModel: { ok: true, count: args.slugs.length },
    uiEvents: [{ type: 'map.show', slugs: args.slugs, ...(args.fly_to ? { flyTo: args.fly_to } : {}) }],
  };
}

export const openDrawerToolDef = {
  name: 'open_drawer',
  description:
    'Open the detail drawer for one specific attraction by slug. Use when the user clearly wants ' +
    'to see one place in depth ("tell me more about Giethoorn"). Don\'t open it after every recommendation.',
  input_schema: {
    type: 'object',
    properties: { slug: { type: 'string' } },
    required: ['slug'],
  },
} as const;

interface OpenArgs {
  slug: string;
}

export async function openDrawer(args: OpenArgs, _ctx: { userId: string }): Promise<ToolResult> {
  return {
    forModel: { ok: true },
    uiEvents: [{ type: 'drawer.open', slug: args.slug }],
  };
}

export const pickLocationOnMapToolDef = {
  name: 'pick_location_on_map',
  description:
    'Ask the user to drop a pin on the map to specify the location of a place they want to add. ' +
    'Use ONLY when adding a new attraction and the user has not provided coordinates by other means ' +
    '(no GPS prefix in their message, no EXIF in attached photos, no clear address you can reverse-geocode). ' +
    'After this tool runs, wait for the user\'s next turn — it will arrive prefixed with `[picked_lat=…, picked_lng=…]`. ' +
    'Do NOT call this tool when the message already contains `[picked_lat=` or `[gps_lat=`.',
  input_schema: {
    type: 'object',
    properties: {
      prompt: {
        type: 'string',
        description:
          'Short hint shown to the user above the map ("Tap the spot where Cheese Shop X is" / "Поставь точку, где находится памятник").',
      },
    },
    required: [],
  },
} as const;

interface PickArgs {
  prompt?: string;
}

export async function pickLocationOnMap(args: PickArgs, _ctx: { userId: string }): Promise<ToolResult> {
  return {
    forModel: { ok: true, awaiting: 'user_picked_coordinates' },
    uiEvents: [{ type: 'map.pickPoint', ...(args.prompt ? { prompt: args.prompt } : {}) }],
  };
}
