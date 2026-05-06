import type { Attraction, AttractionSource, AttractionStatus, Category } from '../types';
import { isCategory } from '../types';

// Shape returned by GET /api/attractions and /api/attractions/:id.
// Snake_case mirrors the Postgres column names — keeps the client thin.
export interface ApiAttractionRecord {
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
  tags: string[] | null;
  source: AttractionSource;
  status: AttractionStatus;
  author_id: string | null;
  photos?: Array<{ url: string; width: number | null; height: number | null }> | null;
}

function formatVideoTime(seconds?: number | null): string | undefined {
  if (seconds == null || !Number.isFinite(seconds)) return undefined;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function mapApiToAttraction(r: ApiAttractionRecord): Attraction {
  const canonical: Category = isCategory(r.category) ? r.category : 'other';
  const hasVideo = r.video_id && r.video_time != null;

  return {
    id: r.id,
    recordId: r.id,
    category: canonical,
    rawCategory: canonical === r.category ? undefined : r.category,
    name: { ru: r.name_ru, en: r.name_en },
    short: { ru: r.short_ru ?? '', en: r.short_en ?? '' },
    full: { ru: r.full_ru ?? '', en: r.full_en ?? '' },
    coordinates: { lat: r.lat, lng: r.lng },
    videoId: hasVideo ? r.video_id ?? undefined : undefined,
    videoTime: hasVideo ? r.video_time ?? undefined : undefined,
    videoTimeFormatted: hasVideo ? r.video_time_fmt || formatVideoTime(r.video_time) : undefined,
    tags: r.tags ?? undefined,
    source: r.source,
    status: r.status,
    authorId: r.author_id ?? undefined,
    photos: r.photos && r.photos.length > 0
      ? r.photos.map((p) => ({ url: p.url, width: p.width ?? undefined, height: p.height ?? undefined }))
      : undefined,
  };
}
