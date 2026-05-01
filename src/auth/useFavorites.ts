import { useCallback, useEffect, useState } from 'react';
import { pb } from './pb';
import { useAuth } from './AuthProvider';

interface FavoriteRecord {
  id: string;
  user: string;
  attraction_id: string;
}

interface FavoritesState {
  ids: Set<string>;
  recordsByAttraction: Map<string, string>; // attraction_id → favorite record id
  isLoading: boolean;
  toggle: (attractionId: string) => Promise<void>;
}

export function useFavorites(): FavoritesState {
  const { user } = useAuth();
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [recordsByAttraction, setRecords] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      setIds(new Set());
      setRecords(new Map());
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    pb.collection('favorites')
      .getFullList<FavoriteRecord>({ filter: `user = "${user.id}"` })
      .then((records) => {
        if (cancelled) return;
        setIds(new Set(records.map((r) => r.attraction_id)));
        setRecords(new Map(records.map((r) => [r.attraction_id, r.id])));
      })
      .catch((err) => {
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
      const existingId = recordsByAttraction.get(attractionId);

      // Optimistic UI: flip immediately, roll back on error.
      const wasFavorite = ids.has(attractionId);
      const optimisticIds = new Set(ids);
      const optimisticRecords = new Map(recordsByAttraction);
      if (wasFavorite) {
        optimisticIds.delete(attractionId);
        optimisticRecords.delete(attractionId);
      } else {
        optimisticIds.add(attractionId);
        optimisticRecords.set(attractionId, '__pending__');
      }
      setIds(optimisticIds);
      setRecords(optimisticRecords);

      try {
        if (wasFavorite && existingId) {
          await pb.collection('favorites').delete(existingId);
        } else {
          const created = await pb.collection('favorites').create<FavoriteRecord>({
            user: user.id,
            attraction_id: attractionId,
          });
          setRecords((prev) => {
            const next = new Map(prev);
            next.set(attractionId, created.id);
            return next;
          });
        }
      } catch (err) {
        // Rollback
        setIds(ids);
        setRecords(recordsByAttraction);
        console.error('[favorites] toggle failed', err);
      }
    },
    [user, ids, recordsByAttraction],
  );

  return { ids, recordsByAttraction, isLoading, toggle };
}
