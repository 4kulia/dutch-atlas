#!/usr/bin/env node
/**
 * Discovery orchestrator.
 *
 * Reads a "raw candidates" JSON (extracted by the agent from Atlas Obscura,
 * Wikivoyage, Reddit, YouTube, etc.) and produces a curated proposals file
 * under data/candidates/. The user reviews the output, deletes bad picks,
 * and moves accepted ones to data/additions/ for the next seed.
 *
 * Pipeline:
 *   1. load raw candidates and existing 136 (with embeddings) and ignored.json
 *   2. dedupe within batch (geo + name)
 *   3. dedupe vs DB (pgvector cosine + geo+name)
 *   4. dedupe vs ignored.json
 *   5. score (novelty + source signal)
 *   6. write data/candidates/<batch>.json
 *
 * Usage:
 *   node scripts/discover.mjs <raw-candidates.json>            # default output
 *   node scripts/discover.mjs <input> --out <output>           # custom output
 *   node scripts/discover.mjs <input> --semantic-threshold 0.85
 *
 * Auto-loads ./.env and ./.env.api when present.
 *
 * Raw candidate shape:
 *   {
 *     "name":         "Plompe Toren",
 *     "hint_lat":     51.683404,
 *     "hint_lng":     3.775199,
 *     "source_url":   "https://www.atlasobscura.com/places/plompe-toren",
 *     "source_label": "exa-ao",
 *     "raw_text":     "Its town washed away…",
 *     "evidence":     "Brick tower from a town swept by storm + mermaid legend"
 *   }
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import pgvector from 'pgvector/pg';
import { isSameCandidate, nameSimilarity, haversine } from './lib/dedup.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const CANDIDATES_DIR = resolve(ROOT, 'data', 'candidates');
const IGNORED_PATH = resolve(ROOT, 'data', 'discovery', 'ignored.json');

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

// ─── args ───────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const rawPath = argv.find((a) => !a.startsWith('--'));
if (!rawPath) {
  console.error('usage: discover.mjs <raw-candidates.json> [--out <path>] [--semantic-threshold N]');
  process.exit(1);
}
const outIdx = argv.indexOf('--out');
const outPath = outIdx >= 0 ? argv[outIdx + 1] : resolve(
  CANDIDATES_DIR,
  `${new Date().toISOString().slice(0, 10)}-discovery.json`,
);
const semIdx = argv.indexOf('--semantic-threshold');
// 0.85 was too aggressive — every NL attraction is "thematically similar" to
// every other NL attraction in voyage space. Use semantic match only as a
// fallback signal; rely on geo + name overlap as the primary dedup.
const SEMANTIC_THRESHOLD = semIdx >= 0 ? Number(argv[semIdx + 1]) : 0.95;

const DATABASE_URL = process.env.DATABASE_URL
  || `postgres://nl_attractions:${process.env.POSTGRES_PASSWORD}@localhost:5440/nl_attractions`;
const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;
if (!VOYAGE_API_KEY) {
  console.error('Need VOYAGE_API_KEY');
  process.exit(1);
}

// ─── load raw candidates ────────────────────────────────────────────────────
const raw = JSON.parse(readFileSync(rawPath, 'utf8'));
if (!Array.isArray(raw)) {
  console.error(`${rawPath}: top-level must be an array of raw candidates`);
  process.exit(1);
}
console.log(`→ raw candidates: ${raw.length} from ${basename(rawPath)}`);

// ─── 2. Within-batch dedup ──────────────────────────────────────────────────
// Two candidates from different sources about the same place → merge.
const merged = [];
for (const c of raw) {
  const hit = merged.find((m) => isSameCandidate(m, c));
  if (hit) {
    hit._sources.push({ url: c.source_url, label: c.source_label });
    // Prefer the longer name and the version that has coords.
    if ((c.name?.length ?? 0) > (hit.name?.length ?? 0)) hit.name = c.name;
    if (!Number.isFinite(hit.hint_lat) && Number.isFinite(c.hint_lat)) {
      hit.hint_lat = c.hint_lat;
      hit.hint_lng = c.hint_lng;
    }
    // Keep the longest evidence/raw_text we've seen.
    if ((c.evidence?.length ?? 0) > (hit.evidence?.length ?? 0)) hit.evidence = c.evidence;
    if ((c.raw_text?.length ?? 0) > (hit.raw_text?.length ?? 0)) hit.raw_text = c.raw_text;
  } else {
    merged.push({
      ...c,
      _sources: [{ url: c.source_url, label: c.source_label }],
    });
  }
}
console.log(`→ within-batch dedup: ${raw.length} → ${merged.length}`);

// ─── 3. Voyage embed for candidates that have content ───────────────────────
async function voyageEmbed(texts, inputType) {
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${VOYAGE_API_KEY}` },
    body: JSON.stringify({ model: 'voyage-3.5', input: texts, input_type: inputType }),
  });
  if (!res.ok) throw new Error(`Voyage ${res.status}: ${await res.text()}`);
  const j = await res.json();
  return { vectors: j.data.map((d) => d.embedding), tokens: j.usage?.total_tokens ?? 0 };
}

const queryTexts = merged.map((m) =>
  [m.name, m.evidence, (m.raw_text ?? '').slice(0, 400)].filter(Boolean).join('\n'),
);
console.log(`→ embedding ${queryTexts.length} candidates with voyage-3.5…`);
const BATCH_SIZE = 32;
const queryVectors = [];
let voyageTokens = 0;
for (let i = 0; i < queryTexts.length; i += BATCH_SIZE) {
  const slice = queryTexts.slice(i, i + BATCH_SIZE);
  const { vectors, tokens } = await voyageEmbed(slice, 'query');
  queryVectors.push(...vectors);
  voyageTokens += tokens;
}
console.log(`  ${voyageTokens} voyage tokens used`);

// ─── 4. DB-side dedup ───────────────────────────────────────────────────────
const client = new pg.Client({ connectionString: DATABASE_URL });
await client.connect();
await pgvector.registerType(client);

const { rows: dbRows } = await client.query(
  'SELECT id, name_en, name_ru, lat, lng FROM attractions',
);
console.log(`→ DB has ${dbRows.length} existing rows`);

const annotated = [];
for (let i = 0; i < merged.length; i += 1) {
  const cand = merged[i];
  const vec = pgvector.toSql(queryVectors[i]);

  // Top-3 semantic neighbours by EN embedding.
  const { rows: nn } = await client.query(
    `SELECT id, name_en, name_ru, lat, lng,
            1 - (embedding_en <=> $1::vector) AS sim
     FROM attractions
     WHERE embedding_en IS NOT NULL
     ORDER BY embedding_en <=> $1::vector
     LIMIT 3`,
    [vec],
  );

  const top = nn[0];
  let dup = null;
  let dupReason = null;

  // (a) Very strong semantic match.
  if (top && top.sim >= SEMANTIC_THRESHOLD) {
    dup = top;
    dupReason = `semantic (sim=${top.sim.toFixed(3)})`;
  }
  // (b) Geo + name overlap with any of the top-3 — handles renames/typos
  //     when both source and DB agree on location.
  if (!dup && Number.isFinite(cand.hint_lat)) {
    for (const n of nn) {
      const d = haversine({ lat: n.lat, lng: n.lng }, { lat: cand.hint_lat, lng: cand.hint_lng });
      if (d < 200 && nameSimilarity(n.name_en, cand.name) >= 0.5) {
        dup = n;
        dupReason = `geo+name (${Math.round(d)}m, sim=${nameSimilarity(n.name_en, cand.name).toFixed(2)})`;
        break;
      }
    }
  }
  // (c) Strong name match — catches drift in DB coords (e.g. Giethoorn
  //     stored at village center vs candidate's harbor coord, ~1.3 km apart).
  //     Require both strong name overlap AND meaningful semantic similarity
  //     so we don't false-positive on common words ("museum", "kerk").
  if (!dup) {
    for (const n of nn) {
      const ns = nameSimilarity(n.name_en, cand.name);
      if (ns >= 0.85 && n.sim >= 0.70) {
        dup = n;
        dupReason = `name+semantic (name_sim=${ns.toFixed(2)}, embed_sim=${n.sim.toFixed(2)})`;
        break;
      }
    }
  }

  annotated.push({
    ...cand,
    _topNeighbour: top ? { id: top.id, name_en: top.name_en, sim: Number(top.sim.toFixed(3)) } : null,
    _duplicate: dup ? { id: dup.id, name_en: dup.name_en, reason: dupReason } : null,
    _novelty: top ? Number((1 - top.sim).toFixed(3)) : 1,
  });
}

// ─── 5. Ignored-list dedup ──────────────────────────────────────────────────
let ignored = [];
if (existsSync(IGNORED_PATH)) {
  try { ignored = JSON.parse(readFileSync(IGNORED_PATH, 'utf8')).ignored ?? []; }
  catch (e) { console.warn(`warning: could not parse ${IGNORED_PATH}: ${e.message}`); }
}
for (const cand of annotated) {
  if (cand._duplicate) continue;
  const hit = ignored.find((ig) => isSameCandidate(
    { name: ig.name, hint_lat: ig.lat, hint_lng: ig.lng },
    cand,
  ));
  if (hit) {
    cand._duplicate = { id: '__ignored__', name_en: hit.name, reason: `ignored (${hit.reason ?? 'previously rejected'})` };
  }
}

// ─── 6. Score + emit ────────────────────────────────────────────────────────
// Anything not flagged as a duplicate is a proposal — the user reviews them.
// Score is purely informational and used for sorting (not gating): higher =
// more likely to be genuinely novel and well-sourced.
function score(cand) {
  if (cand._duplicate) return 0;
  const novelty = cand._novelty ?? 1;
  const sourceSignal = cand._sources.length === 1 ? 0.5 : Math.min(1, 0.5 + 0.2 * cand._sources.length);
  return Number((0.6 * novelty + 0.4 * sourceSignal).toFixed(3));
}

const results = annotated
  .map((c) => ({ ...c, _score: score(c) }))
  .sort((a, b) => b._score - a._score);

const accepted = results.filter((c) => !c._duplicate);
const dups = results.filter((c) => c._duplicate);
const lowScore = []; // no longer gating on score

console.log(`\nResults:`);
console.log(`  proposals (sorted by novelty): ${accepted.length}`);
console.log(`  duplicates:                    ${dups.length}`);

if (dups.length > 0) {
  console.log(`\nTop duplicates rejected:`);
  for (const d of dups.slice(0, 5)) {
    console.log(`  ✗ "${d.name}" → ${d._duplicate.id} (${d._duplicate.reason})`);
  }
}

// Build the output object — agent-friendly: structured proposals + provenance.
const out = {
  generated_at: new Date().toISOString(),
  input_file: rawPath,
  semantic_threshold: SEMANTIC_THRESHOLD,
  totals: {
    raw: raw.length,
    merged: merged.length,
    accepted: accepted.length,
    duplicates: dups.length,
    low_score: lowScore.length,
  },
  voyage_tokens_used: voyageTokens,
  proposals: accepted.map((c) => ({
    name: c.name,
    coordinates: Number.isFinite(c.hint_lat) ? { lat: c.hint_lat, lng: c.hint_lng } : null,
    sources: c._sources,
    evidence: c.evidence ?? null,
    raw_text: c.raw_text ?? null,
    _meta: {
      score: c._score,
      novelty: c._novelty,
      top_neighbour: c._topNeighbour,
    },
  })),
  duplicates: dups.map((c) => ({
    name: c.name,
    matched_id: c._duplicate.id,
    reason: c._duplicate.reason,
    sources: c._sources,
  })),
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
console.log(`\n✅ wrote ${outPath}`);

await client.end();
