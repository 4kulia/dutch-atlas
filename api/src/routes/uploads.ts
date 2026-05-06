import { Router } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import exifr from 'exifr';
import { ulid } from 'ulid';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { config } from '../config.js';
import { query } from '../db.js';
import { requireAuth, type AuthedRequest } from '../auth/middleware.js';

export const uploadsRouter: Router = Router();

const ACCEPT_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_LONG_SIDE = 1600;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.uploadsMaxBytes, files: 1 },
});

let dirReadyPromise: Promise<string> | null = null;
function uploadsAbsoluteDir(): Promise<string> {
  if (dirReadyPromise) return dirReadyPromise;
  const abs = resolve(process.cwd(), config.uploadsDir);
  dirReadyPromise = mkdir(abs, { recursive: true }).then(() => abs);
  return dirReadyPromise;
}

// POST /api/uploads/photo
//   multipart/form-data, single file under `photo` (8 MB cap).
//   Returns { photoId, url, width, height, exif: {lat?, lng?, taken_at?} }.
//   The row is "limbo" (attraction_id NULL) until save_place_draft attaches it.
uploadsRouter.post('/photo', requireAuth, upload.single('photo'), async (req: AuthedRequest, res) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: 'no_file' });
    return;
  }
  if (!ACCEPT_MIME.has(file.mimetype)) {
    res.status(415).json({ error: 'unsupported_media_type', got: file.mimetype });
    return;
  }

  // EXIF extraction must happen BEFORE sharp re-encodes (which would strip it).
  // exifr is forgiving — failures just yield {} and we continue.
  let exif: { lat?: number; lng?: number; taken_at?: string } = {};
  try {
    const parsed = await exifr.parse(file.buffer, { gps: true, pick: ['DateTimeOriginal'] }) as
      | { latitude?: number; longitude?: number; DateTimeOriginal?: Date }
      | undefined;
    if (parsed) {
      if (typeof parsed.latitude === 'number' && typeof parsed.longitude === 'number') {
        exif.lat = parsed.latitude;
        exif.lng = parsed.longitude;
      }
      if (parsed.DateTimeOriginal instanceof Date && !Number.isNaN(parsed.DateTimeOriginal.getTime())) {
        exif.taken_at = parsed.DateTimeOriginal.toISOString();
      }
    }
  } catch {
    // EXIF parsing failed — that's fine, just no GPS hint.
  }

  // Auto-orient via EXIF, downsize, convert to JPEG, drop metadata.
  const id = ulid();
  let buf: Buffer;
  let width = 0;
  let height = 0;
  try {
    const pipe = sharp(file.buffer, { failOn: 'truncated' })
      .rotate()
      .resize({ width: MAX_LONG_SIDE, height: MAX_LONG_SIDE, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true });
    const out = await pipe.toBuffer({ resolveWithObject: true });
    buf = out.data;
    width = out.info.width;
    height = out.info.height;
  } catch (err) {
    console.error('[uploads] sharp failed', err);
    res.status(400).json({ error: 'image_processing_failed' });
    return;
  }

  const dir = await uploadsAbsoluteDir();
  const filename = `${id}.jpg`;
  await writeFile(resolve(dir, filename), buf);

  const url = `/api/uploads/${filename}`;
  await query(
    `INSERT INTO attraction_photos
       (id, attraction_id, uploaded_by, url, width, height, exif_lat, exif_lng, exif_taken_at)
     VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, $8)`,
    [
      id,
      req.user!.id,
      url,
      width,
      height,
      exif.lat ?? null,
      exif.lng ?? null,
      exif.taken_at ?? null,
    ],
  );

  res.json({
    photoId: id,
    url,
    width,
    height,
    exif: {
      lat: exif.lat ?? null,
      lng: exif.lng ?? null,
      taken_at: exif.taken_at ?? null,
    },
  });
});

// Multer's error format isn't JSON by default — translate to our shape.
uploadsRouter.use(((err: unknown, _req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ error: 'file_too_large', maxBytes: config.uploadsMaxBytes });
      return;
    }
    res.status(400).json({ error: 'upload_error', code: err.code });
    return;
  }
  next(err);
}) satisfies import('express').ErrorRequestHandler);
