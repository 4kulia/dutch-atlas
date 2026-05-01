#!/usr/bin/env node
/**
 * Smoke test for vector search via pgvector.
 *
 * Usage:
 *   node scripts/test-search.mjs ru "ветряные мельницы"
 *   node scripts/test-search.mjs en "old castles with history"
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import pgvector from 'pgvector/pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

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

const lang = process.argv[2];
const query = process.argv.slice(3).join(' ');
if (!lang || !['ru', 'en'].includes(lang) || !query) {
  console.error('Usage: node scripts/test-search.mjs <ru|en> "<query>"');
  process.exit(1);
}

const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;
const DATABASE_URL = process.env.DATABASE_URL
  || `postgres://nl_attractions:${process.env.POSTGRES_PASSWORD}@localhost:5440/nl_attractions`;
const EMBED_MODEL = process.env.VOYAGE_EMBED_MODEL || 'voyage-3.5';

const r = await fetch('https://api.voyageai.com/v1/embeddings', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${VOYAGE_API_KEY}` },
  body: JSON.stringify({ model: EMBED_MODEL, input: [query], input_type: 'query' }),
});
if (!r.ok) {
  console.error(`Voyage ${r.status}: ${await r.text()}`);
  process.exit(1);
}
const { data } = await r.json();
const vector = data[0].embedding;

const client = new pg.Client({ connectionString: DATABASE_URL });
await client.connect();
await pgvector.registerType(client);

const col = `embedding_${lang}`;
// Cosine similarity in pgvector: distance = 1 - cos_sim, so smaller is better.
// We use the `<=>` operator (cosine distance) and convert to similarity.
const sql = `
  SELECT id, category, name_${lang} AS name,
         1 - (${col} <=> $1::vector) AS score
    FROM attractions
   WHERE status = 'published' AND ${col} IS NOT NULL
   ORDER BY ${col} <=> $1::vector
   LIMIT 8
`;
const res = await client.query(sql, [pgvector.toSql(vector)]);

console.log(`\nTop ${res.rows.length} matches for "${query}" (${lang}):\n`);
for (const row of res.rows) {
  console.log(`  ${row.score.toFixed(3)}  ${row.id.padEnd(28)} ${row.name} [${row.category}]`);
}

await client.end();
