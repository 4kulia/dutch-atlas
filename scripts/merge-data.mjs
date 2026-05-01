#!/usr/bin/env node
/**
 * Merges data/attractions.base.json with scripts/enrichments.mjs to produce
 * the final data/attractions.json used by the app.
 *
 * Fails loud if any attraction is missing coordinates or English fields.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENRICHMENTS } from './enrichments.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const BASE_PATH = join(ROOT, 'data/attractions.base.json');
const OUT_PATH = join(ROOT, 'data/attractions.json');

const base = JSON.parse(readFileSync(BASE_PATH, 'utf8'));

const merged = [];
const missing = [];

for (const a of base) {
  const e = ENRICHMENTS[a.id];
  if (!e) {
    missing.push(a.id);
    continue;
  }
  if (!e.coordinates || !e.name_en || !e.short_en) {
    missing.push(a.id);
    continue;
  }
  merged.push({
    id: a.id,
    category: a.category,
    name: { ru: a.name.ru, en: e.name_en },
    short: { ru: a.short.ru, en: e.short_en },
    full: { ru: a.full.ru, en: e.full_en ?? e.short_en },
    coordinates: e.coordinates,
    videoTime: a.videoTime,
    videoTimeFormatted: a.videoTimeFormatted,
  });
}

if (missing.length > 0) {
  console.error(`❌ Missing enrichments for: ${missing.join(', ')}`);
  process.exit(1);
}

// Sort by videoTime so that the natural order matches the video timeline.
merged.sort((a, b) => a.videoTime - b.videoTime);

writeFileSync(OUT_PATH, JSON.stringify(merged, null, 2) + '\n');
console.log(`✅ Wrote ${merged.length} attractions → ${OUT_PATH}`);

const counts = {};
for (const a of merged) counts[a.category] = (counts[a.category] ?? 0) + 1;
console.log('Categories:', counts);
