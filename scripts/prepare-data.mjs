#!/usr/bin/env node
/**
 * Builds data/attractions.base.json from docs/netherlands_attractions_timecodes.md
 * and docs/netherlands_transcript.json.
 *
 * Output is a partial Attraction[] with: id, category, name.ru, short.ru,
 * full.ru, videoTime, videoTimeFormatted. Coordinates and English fields
 * are filled in by hand in data/attractions.json afterwards.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const MD_PATH = join(ROOT, 'docs/netherlands_attractions_timecodes.md');
const TRANSCRIPT_PATH = join(ROOT, 'docs/netherlands_transcript.json');
const OUT_PATH = join(ROOT, 'data/attractions.base.json');

const CATEGORY_BY_HEADER = {
  'Крупные города': 'city_large',
  'Исторические и портовые города': 'city_historic',
  'Деревни': 'village',
  'Гидротехнические сооружения': 'hydraulic',
  'Ветроэлектростанции': 'wind',
  'Природные парки и ландшафты': 'nature',
  'Замки': 'castle',
  'Карибская часть Королевства': 'caribbean',
  'Прочие места (короткие упоминания)': 'other',
};

function slugify(name) {
  // Russian → ASCII transliteration for stable IDs
  const map = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
    и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
    с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch',
    ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
  };
  return name
    .toLowerCase()
    .split('')
    .map((c) => map[c] ?? c)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function fmtTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function parseMd(md) {
  const lines = md.split('\n');
  const attractions = [];
  let currentCategory = null;

  for (const line of lines) {
    const h2 = line.match(/^##\s+(.+)$/);
    const h3 = line.match(/^###\s+(.+)$/);
    if (h3) {
      const header = h3[1].trim();
      currentCategory = CATEGORY_BY_HEADER[header] ?? currentCategory;
      continue;
    }
    if (h2) {
      const header = h2[1].trim();
      const mapped = CATEGORY_BY_HEADER[header];
      // Only update if this top-level section maps to a category directly
      // (e.g. "Замки", "Гидротехнические сооружения"). For "Города" we keep the
      // current ### sub-category.
      if (mapped) currentCategory = mapped;
      continue;
    }

    // - **[Name](url) — time** — description
    const itemMatch = line.match(/^-\s+\*\*\[(.+?)\]\((https?:\/\/[^)]+)\)\s*—\s*([^*]+)\*\*\s*—\s*(.+)$/);
    if (!itemMatch || !currentCategory) continue;

    const [, name, url, , description] = itemMatch;
    const tMatch = url.match(/[?&]t=(\d+)/);
    if (!tMatch) continue;
    const videoTime = Number(tMatch[1]);

    attractions.push({
      id: slugify(name),
      category: currentCategory,
      name: { ru: name.trim(), en: '' },
      short: { ru: description.trim(), en: '' },
      full: { ru: '', en: '' },
      coordinates: { lat: 0, lng: 0 },
      videoTime,
      videoTimeFormatted: fmtTime(videoTime),
    });
  }

  return attractions;
}

function attachFullDescriptions(attractions, transcript) {
  const subs = transcript[0].subtitles;
  // Sort attractions by videoTime
  const sorted = [...attractions].sort((a, b) => a.videoTime - b.videoTime);
  // Map id → next time
  const byId = new Map();
  for (let i = 0; i < sorted.length; i++) {
    const next = sorted[i + 1];
    byId.set(sorted[i].id, {
      start: sorted[i].videoTime,
      end: next ? next.videoTime : Infinity,
    });
  }

  for (const a of attractions) {
    const range = byId.get(a.id);
    if (!range) continue;
    // Take subtitles whose start is in [range.start - 8, range.end - 4]
    // -8 because the subtitle for the heading often starts a few seconds before t=
    // -4 to avoid bleed into the next attraction
    const slice = subs
      .filter((s) => s.start >= range.start - 8 && s.start < range.end - 4)
      .map((s) => s.text.trim())
      .filter(Boolean);
    a.full.ru = slice.join(' ').replace(/\s+/g, ' ').trim();
  }
}

const md = readFileSync(MD_PATH, 'utf8');
const transcript = JSON.parse(readFileSync(TRANSCRIPT_PATH, 'utf8'));
const attractions = parseMd(md);
attachFullDescriptions(attractions, transcript);

writeFileSync(OUT_PATH, JSON.stringify(attractions, null, 2) + '\n');
console.log(`Wrote ${attractions.length} attractions → ${OUT_PATH}`);
