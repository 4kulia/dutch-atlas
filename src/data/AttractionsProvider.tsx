import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { pb } from '../auth/pb';
import { mapPbToAttraction, type PbAttractionRecord } from './mapAttraction';
import { ATTRACTIONS_BUNDLED } from './bundled';
import type { Attraction, Category } from '../types';

interface AttractionsState {
  attractions: Attraction[];
  byId: ReadonlyMap<string, Attraction>;
  countByCategory: Record<Category, number>;
  isLoading: boolean;
  // Network/permission errors when loading from PB. UI continues to render
  // off the bundled fallback so a degraded backend doesn't blank the map.
  error: string | null;
  // True until at least one fetch from PB has resolved (success or failure).
  // Components can use this to avoid flickering "empty state" while we're
  // still on the first response.
  hydrated: boolean;
}

const AttractionsContext = createContext<AttractionsState | null>(null);

const CACHE_KEY = 'nl_attractions:cache:v1';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1h

interface CachePayload {
  fetchedAt: number;
  rows: PbAttractionRecord[];
}

function readCache(): PbAttractionRecord[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachePayload;
    if (!parsed?.fetchedAt || Date.now() - parsed.fetchedAt > CACHE_TTL_MS) return null;
    if (!Array.isArray(parsed.rows)) return null;
    return parsed.rows;
  } catch {
    return null;
  }
}

function writeCache(rows: PbAttractionRecord[]) {
  if (typeof window === 'undefined') return;
  try {
    const payload: CachePayload = { fetchedAt: Date.now(), rows };
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    /* localStorage full / disabled — non-fatal */
  }
}

function deriveState(attractions: Attraction[]): {
  byId: Map<string, Attraction>;
  countByCategory: Record<Category, number>;
} {
  const byId = new Map(attractions.map((a) => [a.id, a]));
  const countByCategory = {} as Record<Category, number>;
  for (const a of attractions) {
    countByCategory[a.category] = (countByCategory[a.category] ?? 0) + 1;
  }
  return { byId, countByCategory };
}

export function AttractionsProvider({ children }: { children: ReactNode }) {
  // Three sources, in order of preference: PB live → localStorage cache → bundled JSON.
  const [attractions, setAttractions] = useState<Attraction[]>(() => {
    const cached = readCache();
    if (cached) return cached.map(mapPbToAttraction);
    return ATTRACTIONS_BUNDLED;
  });
  const [hydrated, setHydrated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    pb.collection('attractions')
      .getFullList<PbAttractionRecord>({
        filter: 'status = "published"',
        sort: 'created',
        batch: 200,
      })
      .then((rows) => {
        if (cancelled) return;
        writeCache(rows);
        setAttractions(rows.map(mapPbToAttraction));
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : 'Failed to load attractions';
        console.warn('[attractions] PB fetch failed, using fallback', err);
        setError(msg);
      })
      .finally(() => {
        if (cancelled) return;
        setIsLoading(false);
        setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<AttractionsState>(() => {
    const { byId, countByCategory } = deriveState(attractions);
    return { attractions, byId, countByCategory, isLoading, error, hydrated };
  }, [attractions, isLoading, error, hydrated]);

  return <AttractionsContext.Provider value={value}>{children}</AttractionsContext.Provider>;
}

export function useAttractions(): AttractionsState {
  const ctx = useContext(AttractionsContext);
  if (!ctx) throw new Error('useAttractions must be used inside <AttractionsProvider>');
  return ctx;
}

// Convenience wrapper used by hot paths that only need the byId map.
export function useAttractionsById(): ReadonlyMap<string, Attraction> {
  return useAttractions().byId;
}
