#!/usr/bin/env node
/**
 * Sets up the `attractions` collection in PocketBase and seeds it from
 * data/attractions.json.
 *
 * The collection schema is created via the admin SDK rather than a JSVM
 * migration: the JSVM crashes silently in PB v0.26 on multi-field saves
 * (see CLAUDE.md), and the admin-SDK path is what we already use for
 * Google OAuth bootstrap (setup-pb-oauth.mjs).
 *
 * Idempotent in both phases:
 *   - if the collection exists, schema is left untouched (rerun seed only);
 *   - rows are upserted by `slug`.
 *
 * Usage:
 *   POCKETBASE_ADMIN_EMAIL=… POCKETBASE_ADMIN_PASSWORD=… \
 *     node scripts/setup-attractions.mjs
 *
 * Optional env:
 *   POCKETBASE_URL — default http://localhost:8090
 *   SEED=0 to skip data import (schema only)
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import PocketBase from 'pocketbase';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = resolve(__dirname, '..', 'data', 'attractions.json');

const PB_URL = (process.env.POCKETBASE_URL || 'http://localhost:8090').replace(/\/+$/, '');
const PB_ADMIN_EMAIL = process.env.POCKETBASE_ADMIN_EMAIL;
const PB_ADMIN_PASSWORD = process.env.POCKETBASE_ADMIN_PASSWORD;
const SEED = process.env.SEED !== '0';
const VIDEO_ID = '8O8TIoHpKXQ';

if (!PB_ADMIN_EMAIL || !PB_ADMIN_PASSWORD) {
  console.error('Set POCKETBASE_ADMIN_EMAIL and POCKETBASE_ADMIN_PASSWORD env vars.');
  process.exit(1);
}

const pb = new PocketBase(PB_URL);
pb.autoCancellation(false);

console.log(`→ Authenticating as ${PB_ADMIN_EMAIL} on ${PB_URL}…`);
try {
  await pb.collection('_superusers').authWithPassword(PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD);
} catch (err) {
  console.error('Superuser auth failed:', err?.message || err);
  process.exit(1);
}

// ── 1. Ensure the collection exists ────────────────────────────────────
const users = await pb.collections.getOne('users');

let attractions;
try {
  attractions = await pb.collections.getOne('attractions');
  console.log('✓ Collection "attractions" already exists, skipping schema creation.');
} catch (err) {
  if (err?.status !== 404) {
    console.error('Unexpected error checking collection:', err?.message || err);
    process.exit(1);
  }
  console.log('→ Creating "attractions" collection…');

  const payload = {
    name: 'attractions',
    type: 'base',
    fields: [
      // PB auto-adds the system `id` field; we add the rest.
      { name: 'slug',     type: 'text',   required: true,  max: 80, pattern: '^[a-z0-9_-]+$' },
      { name: 'category', type: 'text',   required: true,  max: 64 },
      { name: 'name_ru',  type: 'text',   required: true,  max: 200 },
      { name: 'name_en',  type: 'text',   required: true,  max: 200 },
      { name: 'short_ru', type: 'text',   max: 800 },
      { name: 'short_en', type: 'text',   max: 800 },
      { name: 'full_ru',  type: 'text' },
      { name: 'full_en',  type: 'text' },
      { name: 'lat',      type: 'number', required: true },
      { name: 'lng',      type: 'number', required: true },
      { name: 'video_id', type: 'text',   max: 32 },
      { name: 'video_time',     type: 'number' },
      { name: 'video_time_fmt', type: 'text', max: 16 },
      {
        name: 'author',
        type: 'relation',
        required: false,
        collectionId: users.id,
        cascadeDelete: false,
        maxSelect: 1,
      },
      { name: 'source', type: 'select', required: true, maxSelect: 1, values: ['curated', 'user'] },
      {
        name: 'status',
        type: 'select',
        required: true,
        maxSelect: 1,
        values: ['draft', 'pending', 'published', 'rejected'],
      },
      // For future vector search: `embedding_text` is the canonical text we'd
      // pass to an embedding model; `embedding_hash` lets the indexer skip
      // re-embedding rows that didn't change.
      { name: 'embedding_text', type: 'text' },
      { name: 'embedding_hash', type: 'text', max: 64 },
      { name: 'created', type: 'autodate', onCreate: true,  onUpdate: false },
      { name: 'updated', type: 'autodate', onCreate: true,  onUpdate: true },
    ],
    indexes: [
      'CREATE UNIQUE INDEX idx_attr_slug ON attractions (slug)',
      'CREATE INDEX idx_attr_status ON attractions (status)',
      'CREATE INDEX idx_attr_author ON attractions (author)',
      'CREATE INDEX idx_attr_category ON attractions (category)',
    ],
    // Public reads see only published rows; signed-in users also see their
    // own drafts/pending submissions.
    listRule:   'status = "published" || (@request.auth.id != "" && author = @request.auth.id)',
    viewRule:   'status = "published" || (@request.auth.id != "" && author = @request.auth.id)',
    // User submissions must start as draft and be owned by the caller.
    // Use `author = @request.auth.id` form — the legacy `@request.body.author`
    // form silently 400s on PB v0.26.
    createRule: '@request.auth.id != "" && author = @request.auth.id && source = "user" && status = "draft"',
    updateRule: '@request.auth.id != "" && author = @request.auth.id && status = "draft"',
    deleteRule: '@request.auth.id != "" && author = @request.auth.id && status = "draft"',
  };

  try {
    attractions = await pb.collections.create(payload);
    console.log('✓ Collection created.');
  } catch (err) {
    console.error('Failed to create collection:', err?.message || err);
    if (err?.response?.data) console.error(JSON.stringify(err.response.data, null, 2));
    process.exit(1);
  }
}

if (!SEED) {
  console.log('SEED=0 set, skipping data import.');
  process.exit(0);
}

// ── 2. Seed / sync rows ────────────────────────────────────────────────
const raw = JSON.parse(readFileSync(DATA_PATH, 'utf8'));
if (!Array.isArray(raw) || raw.length === 0) {
  console.error('attractions.json is empty or not an array');
  process.exit(1);
}

function embeddingText(a) {
  return [
    a.name?.ru, a.name?.en,
    a.short?.ru, a.short?.en,
    a.full?.ru, a.full?.en,
  ].filter(Boolean).join('\n');
}

function rowFromAttraction(a) {
  const text = embeddingText(a);
  return {
    slug: a.id,
    category: a.category,
    name_ru: a.name?.ru ?? '',
    name_en: a.name?.en ?? '',
    short_ru: a.short?.ru ?? '',
    short_en: a.short?.en ?? '',
    full_ru: a.full?.ru ?? '',
    full_en: a.full?.en ?? '',
    lat: a.coordinates?.lat,
    lng: a.coordinates?.lng,
    video_id: VIDEO_ID,
    video_time: a.videoTime ?? null,
    video_time_fmt: a.videoTimeFormatted ?? '',
    author: '',
    source: 'curated',
    status: 'published',
    embedding_text: text,
    embedding_hash: createHash('sha256').update(text).digest('hex').slice(0, 32),
  };
}

console.log('→ Loading existing attractions…');
const existing = new Map();
try {
  const list = await pb.collection('attractions').getFullList({ batch: 200 });
  for (const r of list) existing.set(r.slug, r);
  console.log(`  ${existing.size} rows already in DB`);
} catch (err) {
  console.error('Failed to read attractions:', err?.message || err);
  process.exit(1);
}

let created = 0, updated = 0, unchanged = 0, failed = 0;

for (const a of raw) {
  const row = rowFromAttraction(a);
  const prev = existing.get(row.slug);
  try {
    if (!prev) {
      await pb.collection('attractions').create(row);
      created += 1;
      process.stdout.write('+');
    } else if (
      prev.embedding_hash === row.embedding_hash &&
      prev.lat === row.lat &&
      prev.lng === row.lng &&
      prev.video_time === row.video_time &&
      prev.category === row.category &&
      prev.status === row.status
    ) {
      unchanged += 1;
      process.stdout.write('.');
    } else {
      await pb.collection('attractions').update(prev.id, row);
      updated += 1;
      process.stdout.write('~');
    }
  } catch (err) {
    failed += 1;
    process.stdout.write('!');
    console.error(`\n  ${row.slug}: ${err?.message || err}`);
    if (err?.response?.data) console.error(JSON.stringify(err.response.data, null, 2));
  }
}

console.log(`\n\n✅ ${created} created, ${updated} updated, ${unchanged} unchanged, ${failed} failed.`);
process.exit(failed > 0 ? 1 : 0);
