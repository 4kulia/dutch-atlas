import { Router } from 'express';
import { z } from 'zod';
import { ulid } from 'ulid';
import { query } from '../db.js';
import { requireAuth, type AuthedRequest } from '../auth/middleware.js';

export const chatRouter: Router = Router();

chatRouter.use(requireAuth);

interface SessionRow {
  id: string;
  title: string;
  created_at: Date;
  updated_at: Date;
  preview: string | null;
}

// GET /api/chat/sessions — list current user's sessions, newest first.
chatRouter.get('/sessions', async (req: AuthedRequest, res) => {
  const r = await query<SessionRow>(
    `SELECT s.id, s.title, s.created_at, s.updated_at,
            (SELECT m.content
               FROM chat_messages m
              WHERE m.session_id = s.id AND m.role = 'user'
              ORDER BY m.created_at DESC
              LIMIT 1) AS preview
       FROM chat_sessions s
      WHERE s.user_id = $1
      ORDER BY s.updated_at DESC
      LIMIT 100`,
    [req.user!.id],
  );
  res.json({
    sessions: r.rows.map((s) => ({
      id: s.id,
      title: s.title,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
      preview: s.preview,
    })),
  });
});

const CreateBody = z.object({
  title: z.string().min(1).max(120).optional(),
});

chatRouter.post('/sessions', async (req: AuthedRequest, res) => {
  const parsed = CreateBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_body' });
    return;
  }
  const id = ulid();
  await query(
    `INSERT INTO chat_sessions (id, user_id, title)
     VALUES ($1, $2, COALESCE($3, 'Новый чат'))`,
    [id, req.user!.id, parsed.data.title ?? null],
  );
  res.status(201).json({ session: { id, title: parsed.data.title ?? 'Новый чат' } });
});

interface MessageRow {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  ui_events: unknown;
  created_at: Date;
}

// GET /api/chat/sessions/:id — load full transcript for replay.
chatRouter.get('/sessions/:id', async (req: AuthedRequest, res) => {
  const sessionId = req.params.id;
  const owner = await query<{ id: string; title: string }>(
    'SELECT id, title FROM chat_sessions WHERE id = $1 AND user_id = $2',
    [sessionId, req.user!.id],
  );
  if (owner.rowCount === 0) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  const msgs = await query<MessageRow>(
    `SELECT id, role, content, ui_events, created_at
       FROM chat_messages
      WHERE session_id = $1
      ORDER BY created_at ASC`,
    [sessionId],
  );
  res.json({
    session: { id: owner.rows[0]!.id, title: owner.rows[0]!.title },
    messages: msgs.rows.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      uiEvents: m.ui_events ?? [],
      createdAt: m.created_at,
    })),
  });
});

const RenameBody = z.object({ title: z.string().min(1).max(120) });

chatRouter.patch('/sessions/:id', async (req: AuthedRequest, res) => {
  const parsed = RenameBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_body' });
    return;
  }
  const r = await query(
    `UPDATE chat_sessions SET title = $1, updated_at = now()
      WHERE id = $2 AND user_id = $3`,
    [parsed.data.title, req.params.id, req.user!.id],
  );
  if (r.rowCount === 0) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  res.json({ ok: true });
});

chatRouter.delete('/sessions/:id', async (req: AuthedRequest, res) => {
  const r = await query(
    'DELETE FROM chat_sessions WHERE id = $1 AND user_id = $2',
    [req.params.id, req.user!.id],
  );
  if (r.rowCount === 0) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  res.json({ ok: true });
});
