export type Lang = 'ru' | 'en';

// The canonical categories used by curated attractions and the map's
// filter chips. Extended in 008_categories_and_tags.sql with finer-grained
// types and flavour categories. User-submitted attractions may use any
// string for `category` — unknown values fall through to the `other`
// bucket via `isCategory`.
export type Category =
  | 'city_large'
  | 'city_historic'
  | 'village'
  | 'hydraulic'
  | 'wind'
  | 'nature'
  | 'castle'
  | 'caribbean'
  | 'museum'
  | 'monument'
  | 'architecture'
  | 'coastal'
  | 'religious'
  | 'industrial'
  | 'street_art'
  | 'dark_legend'
  | 'oddity'
  | 'other';

export interface LocalizedString {
  ru: string;
  en: string;
}

export type AttractionSource = 'curated' | 'user';
export type AttractionStatus = 'draft' | 'pending' | 'published' | 'rejected';

export interface Attraction {
  id: string;                        // slug (stable URL key, also used by favorites/notes)
  recordId?: string;                 // PocketBase row id (only for rows that came from PB)
  category: Category;
  rawCategory?: string;              // original string when it didn't match a canonical category
  name: LocalizedString;
  short: LocalizedString;
  full: LocalizedString;
  coordinates: { lat: number; lng: number };
  // Video pointers are optional: user-submitted places may not have one.
  videoId?: string;
  videoTime?: number;
  videoTimeFormatted?: string;
  tags?: string[];                   // free-form labels from controlled vocab; see TAG_LABEL in i18n
  source: AttractionSource;
  status: AttractionStatus;
  authorId?: string;
  // User-uploaded photos. URLs are absolute paths under /api/uploads/.
  photos?: Array<{ url: string; width?: number; height?: number }>;
}

export const VIDEO_ID = '8O8TIoHpKXQ';

export const CATEGORIES: Category[] = [
  'city_large',
  'city_historic',
  'village',
  'nature',
  'castle',
  'religious',
  'museum',
  'monument',
  'architecture',
  'street_art',
  'oddity',
  'dark_legend',
  'coastal',
  'hydraulic',
  'wind',
  'industrial',
  'caribbean',
  'other',
];

const CATEGORY_SET = new Set<Category>(CATEGORIES);

export function isCategory(value: unknown): value is Category {
  return typeof value === 'string' && CATEGORY_SET.has(value as Category);
}
