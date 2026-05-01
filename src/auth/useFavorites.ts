import { useCallback, useEffect, useState } from 'react';
import { ApiError, apiFetch } from './api';
import { useAuth } from './AuthProvider';

interface FavoritesResponse {
  favorites: Array<{ attractionId: string; createdAt: string }>;
}

interface FavoritesState {
  ids: Set<string>;
  isLoading: boolean;
  toggle: (attractionId: string) => Promise<void>;
}

export function useFavorites(): FavoritesState {
  const { user } = useAuth();
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      setIds(new Set());
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    apiFetch<FavoritesResponse>('/api/favorites')
      .then((res) => {
        if (!cancelled) setIds(new Set(res.favorites.map((f) => f.attractionId)));
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) return;
        console.error('[favorites] load failed', err);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const toggle = useCallback(
    async (attractionId: string) => {
      if (!user) return;
      const wasFavorite = ids.has(attractionId);
      const next = new Set(ids);
      if (wasFavorite) next.delete(attractionId);
      else next.add(attractionId);
      setIds(next); // optimistic

      try {
        await apiFetch('/api/favorites', {
          method: 'POST',
          body: JSON.stringify({ attractionId, state: wasFavorite ? 'off' : 'on' }),
        });
      } catch (err) {
        setIds(ids); // rollback
        console.error('[favorites] toggle failed', err);
      }
    },
    [user, ids],
  );

  return { ids, isLoading, toggle };
}
