import raw from '../../data/attractions.json';
import type { Attraction, Category } from '../types';

export const ATTRACTIONS = raw as Attraction[];

export const ATTRACTIONS_BY_ID: ReadonlyMap<string, Attraction> = new Map(
  ATTRACTIONS.map((a) => [a.id, a]),
);

export function countByCategory(): Record<Category, number> {
  const result = {} as Record<Category, number>;
  for (const a of ATTRACTIONS) {
    result[a.category] = (result[a.category] ?? 0) + 1;
  }
  return result;
}
