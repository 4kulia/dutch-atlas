// Tiny SQL-file migration runner. No fancy tooling: each `*.sql` in
// src/schema/ is applied once, in lexical order, and recorded in
// `_migrations`. The first file (001_init.sql) creates the tracking table
// itself, so it runs unconditionally on every boot (CREATE … IF NOT EXISTS).
//
// Run via: `npm run migrate` (locally) or as part of api startup.

import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { config } from './config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA_DIR = join(__dirname, 'schema');

async function listSqlFiles(): Promise<string[]> {
  const entries = await readdir(SCHEMA_DIR);
  return entries.filter((e) => e.endsWith('.sql')).sort();
}

async function alreadyApplied(client: pg.Client, file: string): Promise<boolean> {
  const r = await client.query<{ filename: string }>(
    'SELECT filename FROM _migrations WHERE filename = $1',
    [file],
  );
  return r.rowCount! > 0;
}

export async function runMigrations(): Promise<void> {
  // Use a one-off Client (not the shared pool) so we don't trigger pgvector
  // type registration before the extension exists. The pool's on('connect')
  // hook tries to register the `vector` type, which fails on the very first
  // boot because 001_init.sql hasn't run yet.
  const client = new pg.Client({ connectionString: config.databaseUrl });
  await client.connect();

  try {
    const files = await listSqlFiles();
    if (files.length === 0) return;

    // 001_init.sql is idempotent (CREATE EXTENSION IF NOT EXISTS, CREATE TABLE
    // IF NOT EXISTS). Always run it — it bootstraps pgvector and _migrations.
    const initFile = files[0];
    if (!initFile) return;
    const initSql = await readFile(join(SCHEMA_DIR, initFile), 'utf8');
    await client.query(initSql);

    for (const file of files.slice(1)) {
      try {
        await client.query('BEGIN');
        const seen = await alreadyApplied(client, file);
        if (seen) {
          await client.query('COMMIT');
          continue;
        }
        const sql = await readFile(join(SCHEMA_DIR, file), 'utf8');
        console.log(`→ migrating ${file}`);
        await client.query(sql);
        await client.query('INSERT INTO _migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK').catch(() => undefined);
        console.error(`✗ migration ${file} failed:`, err);
        throw err;
      }
    }
  } finally {
    await client.end();
  }
}

// Allow `npm run migrate` to invoke us directly.
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations()
    .then(() => {
      console.log('✓ migrations done');
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
