// Stable string ids the rest of the app uses. We translate to/from the
// Google Maps SDK enum on demand because that enum only exists once the
// JS API is loaded.
export type TravelMode = 'DRIVING' | 'WALKING' | 'BICYCLING' | 'TRANSIT';

export const DEFAULT_TRAVEL_MODE: TravelMode = 'DRIVING';

export const TRAVEL_MODE_LABEL: Record<TravelMode, { ru: string; en: string }> = {
  DRIVING: { ru: 'Авто', en: 'Drive' },
  WALKING: { ru: 'Пешком', en: 'Walk' },
  BICYCLING: { ru: 'Вело', en: 'Bike' },
  TRANSIT: { ru: 'Транспорт', en: 'Transit' },
};

export const TRAVEL_MODE_ORDER: TravelMode[] = ['DRIVING', 'WALKING', 'BICYCLING', 'TRANSIT'];
