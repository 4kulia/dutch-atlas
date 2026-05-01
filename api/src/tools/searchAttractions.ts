import pgvector from 'pgvector/pg';
import { embedQuery } from '../embed.js';
import { query } from '../db.js';
import type { ToolResult } from './types.js';
import type { ToolContext } from './index.js';

export type Lang = 'ru' | 'en';

interface Args {
  query: string;
  lang: Lang;
  near?: { lat: number; lng: number; radius_km?: number };
  categories?: string[];
  exclude_slugs?: string[];
  limit?: number;
  exclude_visited?: boolean;
  visited_only?: boolean;
}

export const searchAttractionsToolDef = {
  name: 'search_attractions',
  description:
    'Semantic search over the curated Netherlands attractions catalogue. ' +
    'Use this whenever the user describes places by meaning ("quiet villages", ' +
    '"old castles", "windmills"). Returns ranked matches with similarity scores. ' +
    'Always pass `lang` matching the language of the user\'s message. Use `near` ' +
    'and `categories` to narrow results when the user mentions a location or a place type.',
  input_schema: {
    type: 'object',
    properties: {
      query: { type: 'string' },
      lang: { type: 'string', enum: ['ru', 'en'] },
      near: {
        type: 'object',
        description: 'Geographic anchor; filters to within radius_km of (lat, lng).',
        properties: {
          lat: { type: 'number' },
          lng: { type: 'number' },
          radius_km: { type: 'number', description: 'Default 50 km' },
        },
        required: ['lat', 'lng'],
      },
      categories: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Restrict to these categories. Canonical: city_large, city_historic, village, hydraulic, wind, nature, castle, caribbean, other.',
      },
      exclude_slugs: { type: 'array', items: { type: 'string' } },
      limit: { type: 'integer', description: 'Max results (default 6, max 12)' },
      exclude_visited: {
        type: 'boolean',
        description:
          'Exclude places the user has marked as visited. Default true — pass false ONLY when the user explicitly references their visited list ("куда я уже ездил", "что-то знакомое").',
      },
      visited_only: {
        type: 'boolean',
        description:
          'Restrict to places the user has marked as visited. Use for explicit "show my visited" / "where have I been" queries.',
      },
    },
    required: ['query', 'lang'],
  },
} as const;

interface Row {
  id: string;
  category: string;
  name: string;
  short: string | null;
  lat: number;
  lng: number;
  score: number;
}

export async function searchAttractions(args: Args, ctx: ToolContext): Promise<ToolResult> {
  const limit = Math.min(Math.max(args.limit ?? 6, 1), 12);
  const vector = await embedQuery(args.query);
  const vectorSql = pgvector.toSql(vector);
  const col = `embedding_${args.lang}`;
  const nameCol = `name_${args.lang}`;
  const shortCol = `short_${args.lang}`;

  // Build WHERE clauses + parameters incrementally so we can mix vector
  // similarity ordering with optional filters.
  const params: unknown[] = [vectorSql];
  const where: string[] = [`status = 'published'`, `${col} IS NOT NULL`];

  if (args.categories && args.categories.length > 0) {
    params.push(args.categories);
    where.push(`category = ANY($${params.length}::text[])`);
  }
  if (args.exclude_slugs && args.exclude_slugs.length > 0) {
    params.push(args.exclude_slugs);
    where.push(`id <> ALL($${params.length}::text[])`);
  }
  // Visited filter — default behaviour is to exclude places the user has
  // already marked as visited. visited_only flips it to "only those places".
  // Both default to (true, false) so we never show repeats unless asked.
  if (args.visited_only) {
    params.push(ctx.userId);
    where.push(`id IN (SELECT attraction_id FROM visits WHERE user_id = $${params.length})`);
  } else if (args.exclude_visited !== false) {
    params.push(ctx.userId);
    where.push(`id NOT IN (SELECT attraction_id FROM visits WHERE user_id = $${params.length})`);
  }
  if (args.near) {
    // Cheap haversine-ish filter using a degree bounding box. Good enough
    // for our 50 km radius use case; we don't need geometry types here.
    const dLat = (args.near.radius_km ?? 50) / 111; // 1° lat ≈ 111 km
    const dLng = (args.near.radius_km ?? 50) / (111 * Math.cos((args.near.lat * Math.PI) / 180));
    params.push(args.near.lat - dLat);
    where.push(`lat >= $${params.length}`);
    params.push(args.near.lat + dLat);
    where.push(`lat <= $${params.length}`);
    params.push(args.near.lng - dLng);
    where.push(`lng >= $${params.length}`);
    params.push(args.near.lng + dLng);
    where.push(`lng <= $${params.length}`);
  }
  params.push(limit);

  const sql = `
    SELECT id, category, ${nameCol} AS name, ${shortCol} AS short,
           lat, lng,
           1 - (${col} <=> $1::vector) AS score
      FROM attractions
     WHERE ${where.join(' AND ')}
     ORDER BY ${col} <=> $1::vector
     LIMIT $${params.length}
  `;

  const r = await query<Row>(sql, params);
  if (r.rowCount === 0) {
    return { forModel: { matches: [] } };
  }

  const matches = r.rows.map((row) => ({
    slug: row.id,
    name: row.name,
    short: row.short ?? '',
    category: row.category,
    score: Number(row.score.toFixed(3)),
    coordinates: { lat: row.lat, lng: row.lng },
  }));

  return {
    forModel: { matches },
    uiEvents: [
      {
        type: 'cards.attractions',
        items: matches.map((m) => ({
          slug: m.slug,
          name: m.name,
          short: m.short,
          category: m.category,
          score: m.score,
        })),
      },
    ],
  };
}
