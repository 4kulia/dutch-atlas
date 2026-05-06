import pgvector from 'pgvector/pg';
import { createHash } from 'node:crypto';
import { config } from '../config.js';
import { withTransaction } from '../db.js';
import type { ToolResult } from './types.js';
import type { ToolContext } from './index.js';

// Allowed categories — must match the CHECK constraint added in
// 008_categories_and_tags.sql. Anything else gets rejected before we touch
// the DB so we get a clean error back to the model.
const CATEGORIES = new Set([
  'caribbean','castle','city_historic','city_large','hydraulic','nature',
  'village','wind','other',
  'museum','monument','architecture','coastal','religious','industrial',
  'street_art','dark_legend','oddity',
]);

interface Args {
  name_ru: string;
  name_en: string;
  short_ru?: string;
  short_en?: string;
  full_ru?: string;
  full_en?: string;
  category: string;
  tags?: string[];
  lat: number;
  lng: number;
  accuracy_m?: number;
  photo_ids?: string[];
  status?: 'draft' | 'pending';
}

export const savePlaceDraftToolDef = {
  name: 'save_place_draft',
  description:
    'Persist a new user-submitted attraction. Use after you have a name (RU+EN), a short description (RU+EN), ' +
    'a category, lat/lng, and optional photos. The frontend renders the saved place as a card and opens its drawer. ' +
    'Use status="pending" when the user clearly wants to publish ("save", "submit", "add it", "сохрани", "добавь"); ' +
    'use status="draft" only when explicitly asked to save without publishing. Defaults to "pending". ' +
    'NEVER invent coordinates — get them from a `[gps_lat=…]`/`[picked_lat=…]` prefix in the user\'s message, ' +
    'EXIF in an attached photo, or by calling pick_location_on_map first.',
  input_schema: {
    type: 'object',
    properties: {
      name_ru: { type: 'string' },
      name_en: { type: 'string' },
      short_ru: { type: 'string', description: 'One sentence summary in Russian.' },
      short_en: { type: 'string', description: 'One sentence summary in English.' },
      full_ru: { type: 'string', description: 'A paragraph (2–4 sentences) in Russian.' },
      full_en: { type: 'string', description: 'A paragraph (2–4 sentences) in English.' },
      category: {
        type: 'string',
        description:
          'One of: caribbean, castle, city_historic, city_large, hydraulic, nature, village, wind, other, ' +
          'museum, monument, architecture, coastal, religious, industrial, street_art, dark_legend, oddity.',
      },
      tags: { type: 'array', items: { type: 'string' } },
      lat: { type: 'number' },
      lng: { type: 'number' },
      accuracy_m: { type: 'number', description: 'GPS accuracy in metres if known (from device or pin).' },
      photo_ids: {
        type: 'array',
        items: { type: 'string' },
        description: 'photoId values returned by the upload endpoint for photos the user attached.',
      },
      status: { type: 'string', enum: ['draft', 'pending'] },
    },
    required: ['name_ru', 'name_en', 'category', 'lat', 'lng'],
  },
} as const;

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 6);
}

async function embedDocument(text: string): Promise<number[]> {
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.voyageApiKey}`,
    },
    body: JSON.stringify({
      model: config.voyageModel,
      input: [text],
      input_type: 'document',
    }),
  });
  if (!res.ok) {
    throw new Error(`Voyage HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const json = (await res.json()) as { data: Array<{ embedding: number[] }> };
  const v = json.data[0]?.embedding;
  if (!v) throw new Error('Voyage returned no embedding');
  return v;
}

function buildEmbedText(name: string, short: string, full: string, category: string): string {
  return [name, short, full, category].filter((s) => s && s.trim().length > 0).join('\n').trim();
}

function hashText(s: string): string {
  return createHash('sha256').update(s).digest('hex').slice(0, 32);
}

export async function savePlaceDraft(args: Args, ctx: ToolContext): Promise<ToolResult> {
  // Validate up front so the model gets crisp errors instead of SQL noise.
  if (!CATEGORIES.has(args.category)) {
    return { forModel: { error: 'invalid_category', got: args.category, allowed: [...CATEGORIES] } };
  }
  if (!Number.isFinite(args.lat) || !Number.isFinite(args.lng)) {
    return { forModel: { error: 'invalid_coordinates', lat: args.lat, lng: args.lng } };
  }
  if (args.lat < 11.9 || args.lat > 54 || args.lng < -71 || args.lng > 8) {
    return { forModel: { error: 'coordinates_out_of_range', hint: 'Netherlands + Caribbean range only.' } };
  }
  const nameRu = args.name_ru.trim();
  const nameEn = args.name_en.trim();
  if (!nameRu || !nameEn) {
    return { forModel: { error: 'missing_name', hint: 'Both name_ru and name_en are required.' } };
  }

  const status = args.status === 'draft' ? 'draft' : 'pending';

  // Compute embeddings up front (outside the transaction — Voyage call is
  // network I/O that we don't want to hold a DB connection during).
  const textRu = buildEmbedText(nameRu, args.short_ru ?? '', args.full_ru ?? '', args.category);
  const textEn = buildEmbedText(nameEn, args.short_en ?? '', args.full_en ?? '', args.category);
  let vecRu: number[] | null = null;
  let vecEn: number[] | null = null;
  try {
    [vecRu, vecEn] = await Promise.all([embedDocument(textRu), embedDocument(textEn)]);
  } catch (err) {
    console.warn('[save_place_draft] embedding failed, saving without vectors', err);
    // Place can still be created and viewed — just won't appear in semantic
    // search until embeddings are backfilled.
  }

  const result = await withTransaction(async (client) => {
    // Pick a free slug. Try the natural one first, then random suffixes.
    const baseSlug = slugify(nameEn) || `place-${randomSuffix()}`;
    let slug = baseSlug;
    for (let attempt = 0; attempt < 5; attempt++) {
      const exists = await client.query('SELECT 1 FROM attractions WHERE id = $1', [slug]);
      if (exists.rowCount === 0) break;
      slug = `${baseSlug}-${randomSuffix()}`;
    }

    const ruSql = vecRu ? pgvector.toSql(vecRu) : null;
    const enSql = vecEn ? pgvector.toSql(vecEn) : null;
    const ruHash = vecRu ? hashText(textRu) : null;
    const enHash = vecEn ? hashText(textEn) : null;

    await client.query(
      `INSERT INTO attractions (
         id, category, name_ru, name_en, short_ru, short_en, full_ru, full_en,
         lat, lng, video_id, video_time, video_time_fmt,
         tags, author_id, source, status,
         location_accuracy_m, submitted_at,
         embedding_ru, embedding_hash_ru, embedding_en, embedding_hash_en
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,
         $9,$10,NULL,NULL,NULL,
         $11,$12,'user',$13,
         $14,$15,
         $16::vector,$17,$18::vector,$19
       )`,
      [
        slug, args.category,
        nameRu, nameEn,
        args.short_ru ?? null, args.short_en ?? null,
        args.full_ru ?? null, args.full_en ?? null,
        args.lat, args.lng,
        args.tags ?? [], ctx.userId, status,
        Number.isFinite(args.accuracy_m) ? args.accuracy_m : null,
        status === 'pending' ? new Date() : null,
        ruSql, ruHash, enSql, enHash,
      ],
    );

    // Attach the limbo photos that the user uploaded for this place. We
    // only adopt photos that belong to this user AND are still un-attached
    // — defends against a malicious caller passing someone else's photoIds.
    if (args.photo_ids && args.photo_ids.length > 0) {
      await client.query(
        `UPDATE attraction_photos
            SET attraction_id = $1,
                position = ord.position
           FROM (
             SELECT unnest($2::text[]) AS id,
                    generate_subscripts($2::text[], 1) - 1 AS position
           ) AS ord
          WHERE attraction_photos.id = ord.id
            AND attraction_photos.uploaded_by = $3
            AND attraction_photos.attraction_id IS NULL`,
        [slug, args.photo_ids, ctx.userId],
      );
    }

    return { slug };
  });

  return {
    forModel: {
      ok: true,
      slug: result.slug,
      status,
      embedded: vecRu !== null && vecEn !== null,
    },
    uiEvents: [
      {
        type: 'cards.attractions',
        items: [
          {
            slug: result.slug,
            name: args.name_ru || args.name_en,
            short: (args.short_ru ?? args.short_en ?? '').trim(),
            category: args.category,
          },
        ],
      },
      { type: 'draft.saved', slug: result.slug, status },
      { type: 'drawer.open', slug: result.slug },
    ],
  };
}
