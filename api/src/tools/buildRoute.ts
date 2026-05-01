import { query } from '../db.js';
import type { ToolResult, RouteStop } from './types.js';

interface DayInput {
  title: string;
  stops: Array<{ slug: string; arrive_at?: string; note?: string }>;
}

interface Args {
  title?: string;
  days: DayInput[];
  lang: 'ru' | 'en';
}

export const buildRouteToolDef = {
  name: 'build_route',
  description:
    'Build a multi-day route from a set of attraction slugs and emit a structured route ' +
    'card to the UI. Use AFTER you have already chosen the stops via search_attractions / ' +
    'get_attraction_details. Group stops into days; the UI will draw a colour-coded path on ' +
    'the map for each day and show numbered markers. We compute approximate driving minutes ' +
    'between consecutive stops by haversine distance — no live traffic. Don\'t use this for ' +
    'a single-place query; use show_on_map instead.',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Optional title for the route, e.g. "Quiet north"' },
      lang: { type: 'string', enum: ['ru', 'en'] },
      days: {
        type: 'array',
        minItems: 1,
        maxItems: 5,
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            stops: {
              type: 'array',
              minItems: 1,
              maxItems: 8,
              items: {
                type: 'object',
                properties: {
                  slug: { type: 'string' },
                  arrive_at: { type: 'string', description: 'Optional rough time, e.g. "09:00", "morning"' },
                  note: { type: 'string', description: 'Optional one-line note (max ~80 chars)' },
                },
                required: ['slug'],
              },
            },
          },
          required: ['title', 'stops'],
        },
      },
    },
    required: ['days', 'lang'],
  },
} as const;

const EARTH_KM = 6371;
function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(h));
}

// Average driving 70 km/h overland + 5 minute setup overhead per leg. Good
// enough for "this leg is about 50 minutes" estimates without burning a
// Directions API call per stop.
function estimateDriveMinutes(km: number): number {
  if (km <= 0) return 0;
  return Math.round(5 + (km / 70) * 60);
}

export async function buildRoute(args: Args, _ctx: { userId: string }): Promise<ToolResult> {
  const allSlugs = args.days.flatMap((d) => d.stops.map((s) => s.slug));
  if (allSlugs.length === 0) {
    return { forModel: { error: 'no_stops' } };
  }

  const r = await query<{ id: string; lat: number; lng: number; name_ru: string; name_en: string }>(
    `SELECT id, lat, lng, name_ru, name_en
       FROM attractions
      WHERE id = ANY($1::text[])
        AND status = 'published'`,
    [allSlugs],
  );
  const byId = new Map(r.rows.map((row) => [row.id, row]));

  const missing = allSlugs.filter((s) => !byId.has(s));
  if (missing.length > 0) {
    return { forModel: { error: 'unknown_slugs', slugs: missing } };
  }

  const lang = args.lang;
  const enrichedDays = args.days.map((day) => {
    const stops: RouteStop[] = [];
    let prev: { lat: number; lng: number } | null = null;
    for (const s of day.stops) {
      const row = byId.get(s.slug)!;
      const here = { lat: row.lat, lng: row.lng };
      const km = prev ? haversineKm(prev, here) : 0;
      stops.push({
        slug: row.id,
        name: lang === 'en' ? row.name_en : row.name_ru,
        arrive_at: s.arrive_at ?? null,
        drive_minutes_from_prev: prev ? estimateDriveMinutes(km) : null,
        note: s.note ?? null,
      });
      prev = here;
    }
    return { title: day.title, stops };
  });

  return {
    forModel: {
      ok: true,
      title: args.title ?? null,
      days: enrichedDays.map((d) => ({
        title: d.title,
        stops: d.stops.map((s) => ({
          slug: s.slug,
          drive_minutes_from_prev: s.drive_minutes_from_prev,
        })),
      })),
    },
    uiEvents: [
      {
        type: 'route.show',
        ...(args.title ? { title: args.title } : {}),
        days: enrichedDays,
      },
    ],
  };
}
