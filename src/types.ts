export type Lang = 'ru' | 'en';

export type Category =
  | 'city_large'
  | 'city_historic'
  | 'village'
  | 'hydraulic'
  | 'wind'
  | 'nature'
  | 'castle'
  | 'caribbean'
  | 'other';

export interface LocalizedString {
  ru: string;
  en: string;
}

export interface Attraction {
  id: string;
  category: Category;
  name: LocalizedString;
  short: LocalizedString;
  full: LocalizedString;
  coordinates: { lat: number; lng: number };
  videoTime: number;
  videoTimeFormatted: string;
}

export const VIDEO_ID = '8O8TIoHpKXQ';

export const CATEGORIES: Category[] = [
  'city_large',
  'city_historic',
  'village',
  'nature',
  'hydraulic',
  'wind',
  'castle',
  'caribbean',
  'other',
];
