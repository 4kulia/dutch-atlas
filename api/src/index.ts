import { setDefaultResultOrder } from 'node:dns';
import { Agent, setGlobalDispatcher } from 'undici';
// The default docker bridge network has no working IPv6 route; Node's
// fetch (undici) does Happy Eyeballs via its own DNS path that ignores
// `dns-result-order`, so AAAA records to e.g. oauth2.googleapis.com stall
// for ETIMEDOUT before the v4 attempt wins. Pin the global dispatcher to
// IPv4-only and also set Node's lookup order for any legacy http callers.
setDefaultResultOrder('ipv4first');
setGlobalDispatcher(new Agent({ connect: { family: 4 } as never }));

import express from 'express';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { config } from './config.js';
import { runMigrations } from './migrate.js';
import { authRouter } from './routes/auth.js';
import { attractionsRouter } from './routes/attractions.js';
import { favoritesRouter } from './routes/favorites.js';
import { visitsRouter } from './routes/visits.js';
import { notesRouter } from './routes/notes.js';
import { agentRouter } from './routes/agent.js';
import { chatRouter } from './routes/chat.js';
import { uploadsRouter } from './routes/uploads.js';

async function main(): Promise<void> {
  console.log(`api starting (NODE_ENV=${config.nodeEnv})`);
  await runMigrations();
  console.log('migrations complete');

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback'); // we sit behind nginx in prod
  app.use(express.json({ limit: '256kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/attractions', attractionsRouter);
  app.use('/api/favorites', favoritesRouter);
  app.use('/api/visits', visitsRouter);
  app.use('/api/notes', notesRouter);
  app.use('/api/agent', agentRouter);
  app.use('/api/chat', chatRouter);
  app.use('/api/uploads', uploadsRouter);

  // Serve uploaded photos. The router above handles POST /photo; this
  // serves GET /api/uploads/<filename> for everyone (photos are public —
  // they're attached to attractions which are public once published).
  const uploadsAbs = resolve(process.cwd(), config.uploadsDir);
  await mkdir(uploadsAbs, { recursive: true });
  app.use('/api/uploads', express.static(uploadsAbs, {
    // fallthrough:true so missing files fall through to Express's default
    // 404 — fallthrough:false routes a NotFoundError into our generic
    // error handler which would return 500.
    fallthrough: true,
    maxAge: '7d',
    immutable: true,
  }));

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[api] unhandled', err);
    if (res.headersSent) return;
    res.status(500).json({ error: 'internal' });
  });

  app.listen(config.port, () => {
    console.log(`api listening on :${config.port}`);
  });
}

main().catch((err) => {
  console.error('api failed to start', err);
  process.exit(1);
});
