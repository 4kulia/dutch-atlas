import { query } from '../db.js';
import type { ToolResult } from './types.js';

interface Args {
  slug: string;
  lang: 'ru' | 'en';
}

interface Row {
  id: string;
  category: string;
  name: string;
  short: string | null;
  full: string | null;
  lat: number;
  lng: number;
  video_id: string | null;
  video_time: number | null;
  video_time_fmt: string | null;
}

export const getAttractionDetailsToolDef = {
  name: 'get_attraction_details',
  description:
    'Fetch the full description, coordinates, and video timecode for one attraction by its slug. ' +
    'Use this when search returned a candidate and the user wants more depth, or when you need to ' +
    'reason carefully about a place beyond its short blurb.',
  input_schema: {
    type: 'object',
    properties: {
      slug: { type: 'string' },
      lang: { type: 'string', enum: ['ru', 'en'] },
    },
    required: ['slug', 'lang'],
  },
} as const;

export async function getAttractionDetails(args: Args, _ctx: { userId: string }): Promise<ToolResult> {
  const r = await query<Row>(
    `SELECT id, category,
            name_${args.lang === 'en' ? 'en' : 'ru'} AS name,
            short_${args.lang === 'en' ? 'en' : 'ru'} AS short,
            full_${args.lang === 'en' ? 'en' : 'ru'} AS full,
            lat, lng, video_id, video_time, video_time_fmt
       FROM attractions
      WHERE id = $1 AND status = 'published'`,
    [args.slug],
  );
  const row = r.rows[0];
  if (!row) return { forModel: { error: 'not_found', slug: args.slug } };
  return {
    forModel: {
      slug: row.id,
      name: row.name,
      short: row.short,
      full: row.full,
      category: row.category,
      coordinates: { lat: row.lat, lng: row.lng },
      video: row.video_id && row.video_time != null
        ? { id: row.video_id, start_seconds: row.video_time, label: row.video_time_fmt }
        : null,
    },
  };
}
