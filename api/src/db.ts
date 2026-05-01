import pg from 'pg';
import pgvector from 'pgvector/pg';
import { config } from './config.js';

// Single connection pool shared across the process. node-postgres recommends
// one Pool per app, never one per request.
export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  max: 10,
});

// Register the `vector` type (so pgvector columns return as Float32Array
// or number[] instead of strings). Done lazily on first connection.
pool.on('connect', async (client) => {
  await pgvector.registerType(client);
});

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params as never);
}

export async function withTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}
