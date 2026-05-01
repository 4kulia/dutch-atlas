import { Router } from 'express';
import { query } from '../db.js';
import { maybeAuth, type AuthedRequest } from '../auth/middleware.js';

export const attractionsRouter: Router = Router();

interface AttractionRow {
  id: string;
  category: string;
  name_ru: string;
  name_en: string;
  short_ru: string | null;
  short_en: string | null;
  full_ru: string | null;
  full_en: string | null;
  lat: number;
  lng: number;
  video_id: string | null;
  video_time: number | null;
  video_time_fmt: string | null;
  source: 'curated' | 'user';
  status: 'draft' | 'pending' | 'published' | 'rejected';
  author_id: string | null;
}

// GET /api/attractions
//   Public: returns published rows.
//   Authenticated: also includes the caller's own draft/pending submissions
//   so they can see them in the map UI.
attractionsRouter.get('/', maybeAuth, async (req: AuthedRequest, res) => {
  const userId = req.user?.id ?? null;
  const r = await query<AttractionRow>(
    `SELECT id, category, name_ru, name_en, short_ru, short_en, full_ru, full_en,
            lat, lng, video_id, video_time, video_time_fmt,
            source, status, author_id
       FROM attractions
      WHERE status = 'published'
         OR ($1::text IS NOT NULL AND author_id = $1)
      ORDER BY created_at`,
    [userId],
  );
  res.json({ attractions: r.rows });
});

attractionsRouter.get('/:id', maybeAuth, async (req: AuthedRequest, res) => {
  const userId = req.user?.id ?? null;
  const r = await query<AttractionRow>(
    `SELECT id, category, name_ru, name_en, short_ru, short_en, full_ru, full_en,
            lat, lng, video_id, video_time, video_time_fmt,
            source, status, author_id
       FROM attractions
      WHERE id = $1
        AND (status = 'published' OR ($2::text IS NOT NULL AND author_id = $2))`,
    [req.params.id, userId],
  );
  const row = r.rows[0];
  if (!row) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  res.json({ attraction: row });
});
