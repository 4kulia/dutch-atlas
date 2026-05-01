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

agentRouter.post('/messages', async (req: AuthedRequest, res) => {
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_body', issues: parsed.error.issues });
    return;
  }
  const userId = req.user!.id;
  const lang: Lang = parsed.data.lang ?? 'ru';
  const history: ChatTurn[] = parsed.data.history ?? [];
  const message = parsed.data.message.trim();

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

  send('start', { ts: Date.now() });

  // Persist the user turn before we start streaming so it's recoverable
  // even if we crash mid-stream.
  const userMessageId = ulid();
  await query(
    'INSERT INTO chat_messages (id, user_id, role, content) VALUES ($1, $2, $3, $4)',
    [userMessageId, userId, 'user', message],
  ).catch((err) => console.warn('[agent] persist user msg failed', err));

  try {
    const collectedUiEvents: unknown[] = [];
    const result = await runChat({
      lang,
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
      `INSERT INTO chat_messages (id, user_id, role, content, ui_events)
       VALUES ($1, $2, 'assistant', $3, $4::jsonb)`,
      [replyId, userId, result.reply, JSON.stringify(collectedUiEvents)],
    ).catch((err) => console.warn('[agent] persist reply failed', err));

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
