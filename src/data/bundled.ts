// Compile-time fallback dataset. Used while the PB fetch is in flight
// (so the map renders instantly on cold load) and as a degraded mode if
// PocketBase is unreachable.
import raw from '../../data/attractions.json';
import type { Attraction } from '../types';
import { isCategory } from '../types';

interface BundledRow {
  id: string;
  category: string;
  name: { ru: string; en: string };
  short: { ru: string; en: string };
  full: { ru: string; en: string };
  coordinates: { lat: number; lng: number };
  videoTime: number;
  videoTimeFormatted: string;
}

const VIDEO_ID = '8O8TIoHpKXQ';

function fromBundled(r: BundledRow): Attraction {
  return {
    id: r.id,
    category: isCategory(r.category) ? r.category : 'other',
    rawCategory: isCategory(r.category) ? undefined : r.category,
    name: r.name,
    short: r.short,
    full: r.full,
    coordinates: r.coordinates,
    videoId: VIDEO_ID,
    videoTime: r.videoTime,
    videoTimeFormatted: r.videoTimeFormatted,
    source: 'curated',
    status: 'published',
  };
}

export const ATTRACTIONS_BUNDLED: Attraction[] = (raw as BundledRow[]).map(fromBundled);
