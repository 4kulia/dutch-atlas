import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiFetch } from '../auth/api';
import { mapApiToAttraction, type ApiAttractionRecord } from './mapAttraction';
import { ATTRACTIONS_BUNDLED } from './bundled';
import type { Attraction, Category } from '../types';

interface AttractionsState {
  attractions: Attraction[];
  byId: ReadonlyMap<string, Attraction>;
  countByCategory: Record<Category, number>;
  isLoading: boolean;
  error: string | null;
  hydrated: boolean;
  refresh: () => Promise<void>;
}

const AttractionsContext = createContext<AttractionsState | null>(null);

const CACHE_KEY = 'nl_attractions:cache:v2';
const CACHE_TTL_MS = 60 * 60 * 1000;

interface CachePayload {
  fetchedAt: number;
  rows: ApiAttractionRecord[];
}

function readCache(): ApiAttractionRecord[] | null {
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

function writeCache(rows: ApiAttractionRecord[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ fetchedAt: Date.now(), rows } satisfies CachePayload),
    );
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
  const [attractions, setAttractions] = useState<Attraction[]>(() => {
    const cached = readCache();
    if (cached) return cached.map(mapApiToAttraction);
    return ATTRACTIONS_BUNDLED;
  });
  const [hydrated, setHydrated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await apiFetch<{ attractions: ApiAttractionRecord[] }>('/api/attractions');
      writeCache(res.attractions);
      setAttractions(res.attractions.map(mapApiToAttraction));
      setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load attractions';
      console.warn('[attractions] refresh failed', err);
      setError(msg);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    refresh()
      .finally(() => {
        if (cancelled) return;
        setIsLoading(false);
        setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const value = useMemo<AttractionsState>(() => {
    const { byId, countByCategory } = deriveState(attractions);
    return { attractions, byId, countByCategory, isLoading, error, hydrated, refresh };
  }, [attractions, isLoading, error, hydrated, refresh]);

  return <AttractionsContext.Provider value={value}>{children}</AttractionsContext.Provider>;
}

export function useAttractions(): AttractionsState {
  const ctx = useContext(AttractionsContext);
  if (!ctx) throw new Error('useAttractions must be used inside <AttractionsProvider>');
  return ctx;
}

export function useAttractionsById(): ReadonlyMap<string, Attraction> {
  return useAttractions().byId;
}
