import type { Attraction, AttractionSource, AttractionStatus, Category } from '../types';
import { isCategory } from '../types';

// PocketBase row shape returned by /api/collections/attractions/records.
export interface PbAttractionRecord {
  id: string;
  slug: string;
  category: string;
  name_ru: string;
  name_en: string;
  short_ru: string;
  short_en: string;
  full_ru: string;
  full_en: string;
  lat: number;
  lng: number;
  video_id?: string;
  video_time?: number | null;
  video_time_fmt?: string;
  author?: string;
  source: AttractionSource;
  status: AttractionStatus;
}

function formatVideoTime(seconds?: number | null): string | undefined {
  if (seconds == null || !Number.isFinite(seconds)) return undefined;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function mapPbToAttraction(r: PbAttractionRecord): Attraction {
  const canonical: Category = isCategory(r.category) ? r.category : 'other';
  const hasVideo = r.video_id && r.video_time != null;

  return {
    id: r.slug,
    recordId: r.id,
    category: canonical,
    rawCategory: canonical === r.category ? undefined : r.category,
    name: { ru: r.name_ru, en: r.name_en },
    short: { ru: r.short_ru ?? '', en: r.short_en ?? '' },
    full: { ru: r.full_ru ?? '', en: r.full_en ?? '' },
    coordinates: { lat: r.lat, lng: r.lng },
    videoId: hasVideo ? r.video_id : undefined,
    videoTime: hasVideo ? r.video_time ?? undefined : undefined,
    videoTimeFormatted: hasVideo ? r.video_time_fmt || formatVideoTime(r.video_time) : undefined,
    source: r.source,
    status: r.status,
    authorId: r.author || undefined,
  };
}
