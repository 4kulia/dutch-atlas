import { Router } from 'express';
import { z } from 'zod';
import { ulid } from 'ulid';
import { query } from '../db.js';
import { requireAuth, type AuthedRequest } from '../auth/middleware.js';

export const notesRouter: Router = Router();

notesRouter.use(requireAuth);

notesRouter.get('/', async (req: AuthedRequest, res) => {
  const attractionId = typeof req.query.attractionId === 'string' ? req.query.attractionId : null;
  if (attractionId) {
    const r = await query<{ id: string; body: string; created_at: Date; attraction_id: string }>(
      `SELECT id, body, created_at, attraction_id
         FROM notes
        WHERE user_id = $1 AND attraction_id = $2
        ORDER BY created_at DESC`,
      [req.user!.id, attractionId],
    );
    res.json({ notes: r.rows });
    return;
  }
  // No filter — return all notes the user has written, used by My Places.
  const r = await query<{ id: string; body: string; created_at: Date; attraction_id: string }>(
    `SELECT id, body, created_at, attraction_id
       FROM notes
      WHERE user_id = $1
      ORDER BY created_at DESC`,
    [req.user!.id],
  );
  res.json({ notes: r.rows });
});

const CreateBody = z.object({
  attractionId: z.string().min(1).max(120),
  body: z.string().min(1).max(10_000),
});

notesRouter.post('/', async (req: AuthedRequest, res) => {
  const parsed = CreateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_body', issues: parsed.error.issues });
    return;
  }
  const id = ulid();
  await query(
    `INSERT INTO notes (id, user_id, attraction_id, body)
     VALUES ($1, $2, $3, $4)`,
    [id, req.user!.id, parsed.data.attractionId, parsed.data.body],
  );
  const r = await query<{ id: string; body: string; created_at: Date; attraction_id: string }>(
    'SELECT id, body, created_at, attraction_id FROM notes WHERE id = $1',
    [id],
  );
  res.status(201).json({ note: r.rows[0] });
});

notesRouter.delete('/:id', async (req: AuthedRequest, res) => {
  const r = await query(
    'DELETE FROM notes WHERE id = $1 AND user_id = $2',
    [req.params.id, req.user!.id],
  );
  if (r.rowCount === 0) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  res.json({ ok: true });
});
