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

export async function showOnMap(args: ShowArgs): Promise<ToolResult> {
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

export async function openDrawer(args: OpenArgs): Promise<ToolResult> {
  return {
    forModel: { ok: true },
    uiEvents: [{ type: 'drawer.open', slug: args.slug }],
  };
}
