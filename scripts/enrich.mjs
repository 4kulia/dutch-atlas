#!/usr/bin/env node
/**
 * LLM enrichment for discovery proposals.
 *
 * Reads data/candidates/*.json (output of scripts/discover.mjs) and produces
 * a data/additions/<date>-enriched.json file in the seed schema:
 *   { id, category, name, short, full, coordinates, videoId, tags }
 *
 * Uses Anthropic Sonnet 4.6 in batches of N (default 8). Each entry is
 * grounded in the candidate's evidence + raw_text + name; LLM never invents
 * specific facts beyond what the source provides.
 *
 * Usage:
 *   node scripts/enrich.mjs <candidates.json>            # default output path
 *   node scripts/enrich.mjs <candidates.json> --out <p>  # custom output
 *   node scripts/enrich.mjs <candidates.json> --batch 4
 *   node scripts/enrich.mjs <candidates.json> --dry-run  # build prompts, don't call API
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

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

// ─── args ───────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const inPath = argv.find((a) => !a.startsWith('--'));
if (!inPath) {
  console.error('usage: enrich.mjs <candidates.json> [--out <path>] [--batch N] [--dry-run]');
  process.exit(1);
}
const outIdx = argv.indexOf('--out');
const outPath = outIdx >= 0 ? argv[outIdx + 1] : resolve(
  ROOT, 'data', 'additions',
  `${new Date().toISOString().slice(0, 10)}-enriched.json`,
);
const batchIdx = argv.indexOf('--batch');
const BATCH_SIZE = batchIdx >= 0 ? Number(argv[batchIdx + 1]) : 8;
const DRY_RUN = argv.includes('--dry-run');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!DRY_RUN && !ANTHROPIC_API_KEY) {
  console.error('Need ANTHROPIC_API_KEY (or use --dry-run)');
  process.exit(1);
}
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5';

// ─── load + load existing for slug-collision check ──────────────────────────
const raw = JSON.parse(readFileSync(inPath, 'utf8'));
const proposals = raw.proposals ?? raw;
if (!Array.isArray(proposals)) {
  console.error('Input must be discover.mjs output (with .proposals) or a raw array');
  process.exit(1);
}
console.log(`→ ${proposals.length} proposals from ${basename(inPath)}`);

const existingSlugs = new Set();
const mainData = JSON.parse(readFileSync(resolve(ROOT, 'data', 'attractions.json'), 'utf8'));
for (const e of mainData) existingSlugs.add(e.id);
const additionsDir = resolve(ROOT, 'data', 'additions');
if (existsSync(additionsDir)) {
  for (const f of (await import('node:fs')).readdirSync(additionsDir)) {
    if (!f.endsWith('.json')) continue;
    const arr = JSON.parse(readFileSync(resolve(additionsDir, f), 'utf8'));
    for (const e of arr) existingSlugs.add(e.id);
  }
}
console.log(`→ ${existingSlugs.size} existing slugs to avoid collisions`);

// ─── controlled vocabulary (must match scripts/seed-attractions.mjs) ────────
const CATEGORIES = [
  'caribbean','castle','city_historic','city_large','hydraulic','nature','other',
  'village','wind','museum','monument','architecture','coastal','religious',
  'industrial','street_art','dark_legend','oddity',
];
const TAGS = [
  'art','music','science','nature','history','military','religion','food','sport','technology',
  'medieval','golden_age','industrial_era','wwii','cold_war','modern_arch',
  'quirky','spooky','romantic','family_friendly','dark_tourism','hidden_gem','photogenic',
  'legend','ghost_story','eccentric','mural','urban_art','largest_in_world','oldest_in_country',
  'unesco','free_entry','seasonal','byo_bike','ticketed_only','indoor','outdoor',
];

// ─── prompt construction ────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You enrich travel-attraction candidates for a Russian-and-English bilingual map of the Netherlands.

For EACH input candidate, return one JSON object with these fields:

{
  "id":           "kebab-case-slug-ascii",       // unique, transliterate from Russian when possible (e.g. "muzey-x", "zamok-y", "ostrov-z")
  "category":     "<one of allowed categories>",
  "name":         { "ru": "...", "en": "..." },  // canonical local name; transliterate RU if no canonical
  "short":        { "ru": "...", "en": "..." },  // ONE sentence, 80-130 chars, captures the essence
  "full":         { "ru": "...", "en": "..." },  // 2-4 sentences, 250-500 chars each, includes specific facts
  "tags":         ["...", "..."]                 // 1-5 tags from allowed vocabulary
}

Allowed categories (pick exactly one):
${CATEGORIES.join(', ')}

Allowed tags (pick 1-5 — only these strings, no inventions):
${TAGS.join(', ')}

Style guidance:
- Russian: informative, slightly literary, like a thoughtful travel journal. Use «ёлочки» quotes. Avoid marketing fluff.
- English: clean prose, specific facts, no hype. Match the Russian content but read naturally.
- Ground all specific facts (dates, dimensions, names) in the candidate's evidence + raw_text. If unsure, keep it general.
- Slug rules: lowercase ASCII, hyphens, no leading/trailing hyphens, ~5-30 chars. Examples of canonical style: muzey-van-goga, zamok-de-haar, ostrov-teksel, kubicheskie-doma-rotterdam, dom-mondriana, audevater.
- Slug must NOT collide with any existing slug provided.

Category cheat-sheet (use the most specific match):
- museum: any museum building
- monument: memorial, cemetery, named statue, war memorial
- street_art: murals, graffiti walls, urban-art locations
- dark_legend: places defined by a folk legend, ghost story, curse
- oddity: weird single objects/sculptures/installations that aren't clearly a museum or art
- architecture: distinctive single building (modern or historic) where the architecture is the point
- religious: church/abbey/monastery/synagogue when the place is primarily religious-historic
- industrial: ports, factories, abandoned industrial complexes, auctions
- coastal: beach resort, lighthouse, dunes
- castle: fortified residence (any era)
- city_historic / city_large / village: full settlements
- nature: parks, woodlands, lakes, islands
- hydraulic: dykes, dams, locks, storm-surge barriers
- wind: windmill / wind park
- caribbean: Dutch Caribbean territories
- other: only if nothing else fits

OUTPUT: a JSON array (no prose, no markdown fences) with exactly the same number of objects as input candidates, in the same order.`;

function buildBatchUserMessage(candidates, existingSlugsSubset) {
  const lines = [];
  lines.push('CANDIDATES (enrich each, preserve order):');
  lines.push('');
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    lines.push(`--- candidate ${i + 1} ---`);
    lines.push(`name: ${c.name}`);
    if (c.coordinates) {
      lines.push(`coordinates: ${c.coordinates.lat}, ${c.coordinates.lng}`);
    }
    if (c.evidence) lines.push(`evidence: ${c.evidence}`);
    if (c.raw_text) {
      const truncated = c.raw_text.length > 800 ? c.raw_text.slice(0, 800) + '…' : c.raw_text;
      lines.push(`raw_text: ${truncated}`);
    }
    if (c.sources?.length) lines.push(`sources: ${c.sources.map((s) => s.url).join(', ')}`);
    lines.push('');
  }
  lines.push(`SLUGS TO AVOID (already in DB): ${[...existingSlugsSubset].slice(0, 100).join(', ')}…`);
  lines.push('');
  lines.push(`Return a JSON array of ${candidates.length} enriched objects in the same order.`);
  return lines.join('\n');
}

// ─── Anthropic call ────────────────────────────────────────────────────────
async function callAnthropic(userMsg, attempt = 1) {
  const body = {
    model: MODEL,
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMsg }],
  };
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    if (attempt < 3 && (res.status === 429 || res.status >= 500)) {
      console.warn(`  Anthropic ${res.status}, retry in 2s (${attempt}/3)`);
      await new Promise((r) => setTimeout(r, 2000));
      return callAnthropic(userMsg, attempt + 1);
    }
    throw new Error(`Anthropic ${res.status}: ${text}`);
  }
  const j = await res.json();
  return { text: j.content[0].text, usage: j.usage };
}

function parseJsonArray(text) {
  // Strip markdown fences if model added them despite instructions.
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```\s*$/, '');
  }
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start === -1 || end === -1) throw new Error('no JSON array in response');
  return JSON.parse(cleaned.slice(start, end + 1));
}

// ─── main loop ──────────────────────────────────────────────────────────────
const enriched = [];
let totalIn = 0, totalOut = 0;

for (let i = 0; i < proposals.length; i += BATCH_SIZE) {
  const batch = proposals.slice(i, i + BATCH_SIZE);
  console.log(`→ batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(proposals.length / BATCH_SIZE)} (${batch.length} candidates)`);
  const userMsg = buildBatchUserMessage(batch, existingSlugs);

  if (DRY_RUN) {
    console.log(`  [dry-run] would send prompt of ${userMsg.length} chars`);
    continue;
  }

  const { text, usage } = await callAnthropic(userMsg);
  totalIn += usage?.input_tokens ?? 0;
  totalOut += usage?.output_tokens ?? 0;

  let parsed;
  try {
    parsed = parseJsonArray(text);
  } catch (e) {
    console.error(`  ✗ failed to parse batch ${i}: ${e.message}`);
    console.error(`  first 500 chars of response: ${text.slice(0, 500)}`);
    continue;
  }
  if (parsed.length !== batch.length) {
    console.warn(`  ⚠ expected ${batch.length} items, got ${parsed.length}`);
  }

  for (let j = 0; j < parsed.length; j++) {
    const e = parsed[j];
    const cand = batch[j];
    if (!e || !e.id) {
      console.warn(`  ⚠ batch ${i}+${j}: missing id, skipping`);
      continue;
    }
    if (existingSlugs.has(e.id)) {
      console.warn(`  ⚠ slug collision "${e.id}" — appending suffix`);
      let n = 2;
      while (existingSlugs.has(`${e.id}-${n}`)) n++;
      e.id = `${e.id}-${n}`;
    }
    existingSlugs.add(e.id);

    // Splice in the candidate's coords + force videoId null (these aren't
    // tied to the curated YouTube video).
    const out = {
      id: e.id,
      category: e.category,
      name: e.name,
      short: e.short,
      full: e.full,
      coordinates: cand.coordinates ?? null,
      videoId: null,
      videoTime: null,
      videoTimeFormatted: null,
      tags: e.tags ?? [],
    };
    enriched.push(out);
    console.log(`  ✓ ${out.id} → ${out.category} [${(out.tags ?? []).join(', ')}]`);
  }
}

console.log(`\n✅ enriched ${enriched.length}/${proposals.length}`);
console.log(`   tokens: ${totalIn} in, ${totalOut} out`);

if (DRY_RUN) {
  console.log('--dry-run: no file written');
  process.exit(0);
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(enriched, null, 2) + '\n');
console.log(`   wrote ${outPath}`);
