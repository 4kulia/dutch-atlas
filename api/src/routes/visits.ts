import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { requireAuth, type AuthedRequest } from '../auth/middleware.js';

export const visitsRouter: Router = Router();

visitsRouter.use(requireAuth);

visitsRouter.get('/', async (req: AuthedRequest, res) => {
  const r = await query<{ attraction_id: string; created_at: Date }>(
    'SELECT attraction_id, created_at FROM visits WHERE user_id = $1 ORDER BY created_at DESC',
    [req.user!.id],
  );
  res.json({
    visits: r.rows.map((row) => ({ attractionId: row.attraction_id, createdAt: row.created_at })),
  });
});

const ToggleBody = z.object({
  attractionId: z.string().min(1).max(120),
  state: z.enum(['on', 'off']),
});

visitsRouter.post('/', async (req: AuthedRequest, res) => {
  const parsed = ToggleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_body', issues: parsed.error.issues });
    return;
  }
  const { attractionId, state } = parsed.data;
  if (state === 'on') {
    await query(
      `INSERT INTO visits (user_id, attraction_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [req.user!.id, attractionId],
    );
  } else {
    await query('DELETE FROM visits WHERE user_id = $1 AND attraction_id = $2', [
      req.user!.id,
      attractionId,
    ]);
  }
  res.json({ ok: true });
});
