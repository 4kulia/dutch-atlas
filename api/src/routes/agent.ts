import { Router } from 'express';
import { z } from 'zod';
import { ulid } from 'ulid';
import { requireAuth, type AuthedRequest } from '../auth/middleware.js';
import { query } from '../db.js';
import { runChat, type ChatTurn, type Lang } from '../agent.js';

export const agentRouter: Router = Router();

agentRouter.use(requireAuth);

const Body = z.object({
  message: z.string().min(1).max(2000),
  lang: z.enum(['ru', 'en']).optional(),
  travelMode: z.enum(['DRIVING', 'WALKING', 'BICYCLING', 'TRANSIT']).optional(),
  sessionId: z.string().min(1).max(40).optional(),
  history: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string().max(10_000),
    }),
  ).max(20).optional(),
});

// Per-user rate limit: 60 messages per hour. Tracked in-memory; sufficient
// for a single api replica.
interface Bucket { tokens: number; resetAt: number; }
const buckets = new Map<string, Bucket>();
function tryConsume(key: string, capacity: number, windowMs: number) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { tokens: capacity - 1, resetAt: now + windowMs });
    return { allowed: true };
  }
  if (b.tokens > 0) { b.tokens -= 1; return { allowed: true }; }
  return { allowed: false, retryAfterSec: Math.ceil((b.resetAt - now) / 1000) };
}

function summariseTitle(text: string): string {
  // Use the first prompt as a starting title — trimmed to one short line.
  const oneLine = text.replace(/\s+/g, ' ').trim();
  if (oneLine.length <= 60) return oneLine || 'Новый чат';
  return oneLine.slice(0, 57).trimEnd() + '…';
}

agentRouter.post('/messages', async (req: AuthedRequest, res) => {
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_body', issues: parsed.error.issues });
    return;
  }
  const userId = req.user!.id;
  const lang: Lang = parsed.data.lang ?? 'ru';
  const travelMode = parsed.data.travelMode ?? 'DRIVING';
  const history: ChatTurn[] = parsed.data.history ?? [];
  const message = parsed.data.message.trim();

  // Resolve session — either an existing one owned by the caller, or a
  // freshly created session whose title we'll set from this first prompt.
  let sessionId = parsed.data.sessionId ?? null;
  let sessionFresh = false;
  if (sessionId) {
    const owner = await query<{ id: string }>(
      'SELECT id FROM chat_sessions WHERE id = $1 AND user_id = $2',
      [sessionId, userId],
    );
    if (owner.rowCount === 0) {
      res.status(404).json({ error: 'session_not_found' });
      return;
    }
  } else {
    sessionId = ulid();
    await query(
      'INSERT INTO chat_sessions (id, user_id, title) VALUES ($1, $2, $3)',
      [sessionId, userId, summariseTitle(message)],
    );
    sessionFresh = true;
  }

  const rl = tryConsume(`u:${userId}`, 60, 60 * 60 * 1000);
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfterSec));
    res.status(429).json({ error: 'rate_limit', retryAfterSec: rl.retryAfterSec });
    return;
  }

  // SSE headers — must precede any writes.
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const ac = new AbortController();
  req.on('close', () => ac.abort());

  send('start', { ts: Date.now(), sessionId, sessionFresh });

  // Persist the user turn before we start streaming so it's recoverable
  // even if we crash mid-stream.
  const userMessageId = ulid();
  await query(
    `INSERT INTO chat_messages (id, user_id, session_id, role, content)
     VALUES ($1, $2, $3, $4, $5)`,
    [userMessageId, userId, sessionId, 'user', message],
  ).catch((err) => console.warn('[agent] persist user msg failed', err));

  try {
    const collectedUiEvents: unknown[] = [];
    const result = await runChat({
      lang,
      travelMode,
      history,
      userMessage: message,
      signal: ac.signal,
      onText: (delta) => send('text', { delta }),
      onUiEvent: (event) => {
        collectedUiEvents.push(event);
        send('ui', event);
      },
      onToolUseStart: (info) => send('tool', { phase: 'start', name: info.name, id: info.id }),
    });

    // Persist the assistant reply (text + ui events) for replay on other devices.
    const replyId = ulid();
    await query(
      `INSERT INTO chat_messages (id, user_id, session_id, role, content, ui_events)
       VALUES ($1, $2, $3, 'assistant', $4, $5::jsonb)`,
      [replyId, userId, sessionId, result.reply, JSON.stringify(collectedUiEvents)],
    ).catch((err) => console.warn('[agent] persist reply failed', err));

    // Bump the session's updated_at so the list re-orders.
    await query('UPDATE chat_sessions SET updated_at = now() WHERE id = $1', [sessionId])
      .catch((err) => console.warn('[agent] bump session failed', err));

    send('done', { usage: result.usage });
  } catch (err) {
    if (ac.signal.aborted) return;
    const msg = err instanceof Error ? err.message : 'agent failed';
    console.error('[agent] error', err);
    send('error', { message: msg });
  } finally {
    res.end();
  }
});
