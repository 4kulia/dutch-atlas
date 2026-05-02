#!/usr/bin/env node
/**
 * Backfill tags onto existing attraction entries.
 *
 * Reads attractions JSON files, picks entries that have no `tags`
 * (or empty array), batches them through Sonnet to assign 1-5 tags
 * from the controlled vocabulary, and writes the JSON back in place.
 *
 * Usage:
 *   node scripts/tag-backfill.mjs <file1.json> [<file2.json>...]
 *   node scripts/tag-backfill.mjs <file> --batch 12
 *   node scripts/tag-backfill.mjs <file> --dry-run
 *   node scripts/tag-backfill.mjs <file> --force      # also re-tag entries that already have tags
 */
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
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

const argv = process.argv.slice(2);
const batchIdx = argv.indexOf('--batch');
const BATCH_SIZE = batchIdx >= 0 ? Number(argv[batchIdx + 1]) : 12;
// Skip flags AND values consumed by flags (--batch <N>).
const consumed = new Set();
if (batchIdx >= 0) { consumed.add(batchIdx); consumed.add(batchIdx + 1); }
const paths = argv.filter((a, i) => !a.startsWith('--') && !consumed.has(i));
if (paths.length === 0) {
  console.error('usage: tag-backfill.mjs <file1.json> [<file2.json>...] [--batch N] [--dry-run] [--force]');
  process.exit(1);
}
const DRY_RUN = argv.includes('--dry-run');
const FORCE = argv.includes('--force');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!DRY_RUN && !ANTHROPIC_API_KEY) {
  console.error('Need ANTHROPIC_API_KEY (or use --dry-run)');
  process.exit(1);
}
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5';

const ALLOWED_TAGS = [
  'art','music','science','nature','history','military','religion','food','sport','technology',
  'medieval','golden_age','industrial_era','wwii','cold_war','modern_arch',
  'quirky','spooky','romantic','family_friendly','dark_tourism','hidden_gem','photogenic',
  'legend','ghost_story','eccentric','mural','urban_art','largest_in_world','oldest_in_country',
  'unesco','free_entry','seasonal','byo_bike','ticketed_only','indoor','outdoor',
];
const ALLOWED_SET = new Set(ALLOWED_TAGS);

const SYSTEM_PROMPT = `You assign tags to existing Netherlands attractions for a bilingual map.

For each attraction (id + category + name + short + full description), pick 1-5 tags from this controlled vocabulary — only these strings, no inventions:

${ALLOWED_TAGS.join(', ')}

Tag groups (pick across them — typically 1-2 theme tags + 1-2 era/vibe tags + 0-1 practical):
- THEME:    art, music, science, nature, history, military, religion, food, sport, technology
- ERA:      medieval, golden_age, industrial_era, wwii, cold_war, modern_arch
- VIBE:     quirky, spooky, romantic, family_friendly, dark_tourism, hidden_gem, photogenic, legend, ghost_story, eccentric, mural, urban_art, largest_in_world, oldest_in_country
- PRACTICAL: unesco, free_entry, seasonal, byo_bike, ticketed_only, indoor, outdoor

Rules:
- Be conservative — fewer accurate tags > many speculative ones.
- Don't repeat the category as a tag (a museum doesn't need 'museum' tag — it has category=museum).
- Prefer specific over generic (golden_age > history when applicable).
- Practical tags: only if obviously true from the description.

OUTPUT: a JSON array of objects { "id": "...", "tags": [...] } in the same order as input. No prose, no markdown fences.`;

function buildBatchUserMessage(entries) {
  const lines = ['ENTRIES:', ''];
  for (const e of entries) {
    lines.push(`--- id: ${e.id} ---`);
    lines.push(`category: ${e.category}`);
    lines.push(`name: ${e.name?.en ?? ''} / ${e.name?.ru ?? ''}`);
    if (e.short?.en) lines.push(`short: ${e.short.en}`);
    if (e.full?.en) {
      const t = e.full.en.length > 600 ? e.full.en.slice(0, 600) + '…' : e.full.en;
      lines.push(`full: ${t}`);
    }
    lines.push('');
  }
  lines.push(`Return JSON array with ${entries.length} objects, same order.`);
  return lines.join('\n');
}

async function callAnthropic(userMsg, attempt = 1) {
  const body = {
    model: MODEL,
    max_tokens: 4000,
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
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```\s*$/, '');
  }
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start === -1 || end === -1) throw new Error('no JSON array in response');
  return JSON.parse(cleaned.slice(start, end + 1));
}

let totalIn = 0, totalOut = 0, totalTagged = 0, totalDropped = 0;

for (const path of paths) {
  console.log(`\n→ ${basename(path)}`);
  const data = JSON.parse(readFileSync(path, 'utf8'));
  if (!Array.isArray(data)) {
    console.error(`  skipping (not an array)`);
    continue;
  }

  const targets = data.filter((e) => FORCE || !Array.isArray(e.tags) || e.tags.length === 0);
  console.log(`  ${data.length} entries, ${targets.length} need tagging`);
  if (targets.length === 0) continue;

  const tagsById = new Map();
  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    const batch = targets.slice(i, i + BATCH_SIZE);
    console.log(`  batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(targets.length / BATCH_SIZE)} (${batch.length})`);
    const userMsg = buildBatchUserMessage(batch);
    if (DRY_RUN) {
      console.log(`    [dry-run] prompt ${userMsg.length} chars`);
      continue;
    }
    const { text, usage } = await callAnthropic(userMsg);
    totalIn += usage?.input_tokens ?? 0;
    totalOut += usage?.output_tokens ?? 0;
    let parsed;
    try { parsed = parseJsonArray(text); }
    catch (e) {
      console.error(`    ✗ parse failed: ${e.message}\n    response head: ${text.slice(0, 300)}`);
      continue;
    }
    for (const r of parsed) {
      if (!r.id || !Array.isArray(r.tags)) continue;
      const filtered = r.tags.filter((t) => ALLOWED_SET.has(t));
      const dropped = r.tags.length - filtered.length;
      if (dropped > 0) totalDropped += dropped;
      tagsById.set(r.id, filtered.slice(0, 5));
    }
  }

  if (!DRY_RUN) {
    let updated = 0;
    for (const e of data) {
      if (tagsById.has(e.id)) {
        e.tags = tagsById.get(e.id);
        updated += 1;
        totalTagged += 1;
      }
    }
    writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
    console.log(`  ✓ wrote ${updated} tag updates`);
  }
}

console.log(`\nDONE. tagged ${totalTagged} entries, dropped ${totalDropped} out-of-vocab tags`);
console.log(`tokens: ${totalIn} in, ${totalOut} out`);
