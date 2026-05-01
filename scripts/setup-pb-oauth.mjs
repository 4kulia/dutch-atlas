#!/usr/bin/env node
/**
 * Configures PocketBase Google OAuth provider from a Google Cloud
 * "client_secret_<id>.json" file.
 *
 * Usage:
 *   POCKETBASE_ADMIN_EMAIL=you@example.com \
 *   POCKETBASE_ADMIN_PASSWORD='...' \
 *   node scripts/setup-pb-oauth.mjs path/to/client_secret_xxx.json
 *
 * Optional env:
 *   POCKETBASE_URL — default http://localhost:8090
 *
 * The script:
 *   1. Reads Google OAuth client_id + client_secret from the JSON file.
 *   2. Authenticates as a PocketBase admin (super-user).
 *   3. Enables Google OAuth in settings and writes the credentials.
 *   4. Ensures the `users` collection allows the `google` OAuth provider.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import PocketBase from 'pocketbase';

const credsPath = process.argv[2];
if (!credsPath) {
  console.error('Usage: node scripts/setup-pb-oauth.mjs <client_secret_xxx.json>');
  process.exit(1);
}

const PB_URL = (process.env.POCKETBASE_URL || 'http://localhost:8090').replace(/\/+$/, '');
const PB_ADMIN_EMAIL = process.env.POCKETBASE_ADMIN_EMAIL;
const PB_ADMIN_PASSWORD = process.env.POCKETBASE_ADMIN_PASSWORD;

if (!PB_ADMIN_EMAIL || !PB_ADMIN_PASSWORD) {
  console.error('Set POCKETBASE_ADMIN_EMAIL and POCKETBASE_ADMIN_PASSWORD env vars.');
  console.error('Tip: prefix the command with the env vars or use a `.env.pb` file you source.');
  process.exit(1);
}

let raw;
try {
  raw = readFileSync(resolve(credsPath), 'utf8');
} catch (err) {
  console.error(`Failed to read ${credsPath}:`, err.message);
  process.exit(1);
}

let parsed;
try {
  parsed = JSON.parse(raw);
} catch (err) {
  console.error('Could not parse JSON:', err.message);
  process.exit(1);
}

// Google Cloud downloads are wrapped under "web" or "installed".
const cfg = parsed.web || parsed.installed || parsed;
const clientId = cfg.client_id;
const clientSecret = cfg.client_secret;

if (!clientId || !clientSecret) {
  console.error('Missing client_id or client_secret in the JSON file.');
  process.exit(1);
}

const pb = new PocketBase(PB_URL);

console.log(`→ Authenticating as ${PB_ADMIN_EMAIL} on ${PB_URL}…`);
try {
  // PocketBase v0.23+ moved admins into the `_superusers` collection.
  await pb.collection('_superusers').authWithPassword(PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD);
} catch (err) {
  console.error('Superuser auth failed:', err.message || err);
  console.error('Did you create the superuser at', `${PB_URL}/_/`, 'first?');
  process.exit(1);
}

console.log('→ Updating Google OAuth provider on the users collection…');
try {
  const users = await pb.collections.getOne('users');
  // In PB 0.23+ each auth collection has its own `oauth2.providers` array
  // and an `oauth2.enabled` toggle.
  const oauth2 = users.oauth2 || { enabled: false, providers: [] };
  const filtered = (oauth2.providers || []).filter((p) => p.name !== 'google');
  const newProviders = [
    ...filtered,
    {
      name: 'google',
      clientId,
      clientSecret,
    },
  ];
  await pb.collections.update(users.id, {
    oauth2: {
      enabled: true,
      providers: newProviders,
    },
  });
  console.log('  users.oauth2.enabled = true; google provider configured');
} catch (err) {
  console.error('Failed to update users collection oauth2 settings:', err.message || err);
  process.exit(1);
}

console.log('\n✅ Google OAuth is configured.');
console.log(`Client ID ends with: …${clientId.slice(-12)}`);
console.log(`Try signing in at http://localhost:5173`);
