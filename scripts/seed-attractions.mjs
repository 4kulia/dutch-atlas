#!/usr/bin/env node
/**
 * Seeds (or re-syncs) the curated 99 attractions into Postgres + computes
 * voyage-3.5 embeddings for both languages.
 *
 * Idempotent: matches by id, recomputes embeddings only when the source
 * text hash changed.
 *
 * Usage:
 *   DATABASE_URL=postgres://… VOYAGE_API_KEY=… \
 *     node scripts/seed-attractions.mjs
 *
 * Auto-loads ./.env and ./.env.api when present.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import pg from 'pg';
import pgvector from 'pgvector/pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DATA_PATH = resolve(ROOT, 'data', 'attractions.json');

function loadEnv(path) {
  if (!existsSync(path)) return;
  for (const rawLine of readFileSync(path, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const k = line.slice(0, eq).trim();
    const v = line.slice(eq + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}
loadEnv(resolve(ROOT, '.env'));
loadEnv(resolve(ROOT, '.env.api'));

const DATABASE_URL = process.env.DATABASE_URL
  || `postgres://nl_attractions:${process.env.POSTGRES_PASSWORD}@localhost:5440/nl_attractions`;
const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;
const EMBED_MODEL = process.env.VOYAGE_EMBED_MODEL || 'voyage-3.5';
const VIDEO_ID = '8O8TIoHpKXQ';
const BATCH = 32;

if (!VOYAGE_API_KEY) {
  console.error('Need VOYAGE_API_KEY');
  process.exit(1);
}

const raw = JSON.parse(readFileSync(DATA_PATH, 'utf8'));
console.log(`→ ${raw.length} rows in data/attractions.json`);

function buildText(a, lang) {
  const name = a.name?.[lang] ?? '';
  const short = a.short?.[lang] ?? '';
  const full = a.full?.[lang] ?? '';
  return [name, short, full, a.category].filter(Boolean).join('\n').trim();
}

function hash(text) {
  return createHash('sha256').update(text).digest('hex').slice(0, 32);
}

async function voyageEmbed(texts, inputType) {
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${VOYAGE_API_KEY}` },
    body: JSON.stringify({ model: EMBED_MODEL, input: texts, input_type: inputType }),
  });
  if (!res.ok) throw new Error(`Voyage ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return { vectors: json.data.map((d) => d.embedding), tokens: json.usage?.total_tokens ?? 0 };
}

const client = new pg.Client({ connectionString: DATABASE_URL });
await client.connect();
await pgvector.registerType(client);

console.log('→ loading existing rows…');
const existingRes = await client.query(
  'SELECT id, embedding_hash_ru, embedding_hash_en FROM attractions',
);
const existing = new Map(existingRes.rows.map((r) => [r.id, r]));
console.log(`  ${existing.size} rows already in DB`);

let totalTokens = 0;
let created = 0;
let updated = 0;
let unchanged = 0;
const reembedNeeded = []; // entries that need new vectors

// Phase 1: upsert metadata for every row, decide which need embedding refresh.
for (const a of raw) {
  const textRu = buildText(a, 'ru');
  const textEn = buildText(a, 'en');
  const hRu = hash(textRu);
  const hEn = hash(textEn);
  const prev = existing.get(a.id);
  const needRu = !prev || prev.embedding_hash_ru !== hRu;
  const needEn = !prev || prev.embedding_hash_en !== hEn;

  await client.query(
    `INSERT INTO attractions (
        id, category, name_ru, name_en, short_ru, short_en, full_ru, full_en,
        lat, lng, video_id, video_time, video_time_fmt,
        author_id, source, status
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NULL,'curated','published')
     ON CONFLICT (id) DO UPDATE SET
        category = EXCLUDED.category,
        name_ru = EXCLUDED.name_ru, name_en = EXCLUDED.name_en,
        short_ru = EXCLUDED.short_ru, short_en = EXCLUDED.short_en,
        full_ru = EXCLUDED.full_ru, full_en = EXCLUDED.full_en,
        lat = EXCLUDED.lat, lng = EXCLUDED.lng,
        video_id = EXCLUDED.video_id, video_time = EXCLUDED.video_time, video_time_fmt = EXCLUDED.video_time_fmt,
        updated_at = now()`,
    [
      a.id, a.category,
      a.name?.ru ?? '', a.name?.en ?? '',
      a.short?.ru ?? null, a.short?.en ?? null,
      a.full?.ru ?? null, a.full?.en ?? null,
      a.coordinates?.lat, a.coordinates?.lng,
      VIDEO_ID, a.videoTime ?? null, a.videoTimeFormatted ?? null,
    ],
  );

  if (!prev) created += 1;
  else if (needRu || needEn) updated += 1;
  else unchanged += 1;

  if (needRu) reembedNeeded.push({ id: a.id, lang: 'ru', text: textRu, hash: hRu });
  if (needEn) reembedNeeded.push({ id: a.id, lang: 'en', text: textEn, hash: hEn });
}
console.log(`  ${created} created, ${updated} updated, ${unchanged} unchanged`);

// Phase 2: batch-embed the texts that changed.
console.log(`→ embedding ${reembedNeeded.length} text variants…`);
for (let i = 0; i < reembedNeeded.length; i += BATCH) {
  const slice = reembedNeeded.slice(i, i + BATCH);
  const { vectors, tokens } = await voyageEmbed(slice.map((s) => s.text), 'document');
  totalTokens += tokens;

  for (let j = 0; j < slice.length; j++) {
    const item = slice[j];
    const vec = pgvector.toSql(vectors[j]);
    if (item.lang === 'ru') {
      await client.query(
        'UPDATE attractions SET embedding_ru = $1::vector, embedding_hash_ru = $2 WHERE id = $3',
        [vec, item.hash, item.id],
      );
    } else {
      await client.query(
        'UPDATE attractions SET embedding_en = $1::vector, embedding_hash_en = $2 WHERE id = $3',
        [vec, item.hash, item.id],
      );
    }
  }
  process.stdout.write(`.`.repeat(slice.length));
}
console.log(`\n  done. voyage tokens used: ${totalTokens}`);

await client.end();
console.log('✅ seed complete');
