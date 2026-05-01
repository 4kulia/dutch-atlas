import { useEffect, useState } from 'react';
import { pb } from './pb';
import { useAuth } from './AuthProvider';

interface MyPlacesState {
  favoriteIds: Set<string>;
  notesByAttraction: Map<string, number>;
  isLoading: boolean;
  reload: () => void;
}

export function useMyPlaces(refreshKey: number = 0): MyPlacesState {
  const { user } = useAuth();
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [notesByAttraction, setNotesByAttraction] = useState<Map<string, number>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [internalKey, setInternalKey] = useState(0);

  useEffect(() => {
    if (!user) {
      setFavoriteIds(new Set());
      setNotesByAttraction(new Map());
      return;
    }
    let cancelled = false;
    setIsLoading(true);

    Promise.all([
      pb.collection('favorites').getFullList<{ attraction_id: string }>({
        filter: `user = "${user.id}"`,
      }),
      pb.collection('notes').getFullList<{ attraction_id: string }>({
        filter: `user = "${user.id}"`,
      }),
    ])
      .then(([favs, notes]) => {
        if (cancelled) return;
        setFavoriteIds(new Set(favs.map((f) => f.attraction_id)));
        const counts = new Map<string, number>();
        for (const n of notes) {
          counts.set(n.attraction_id, (counts.get(n.attraction_id) ?? 0) + 1);
        }
        setNotesByAttraction(counts);
      })
      .catch((err) => {
        if (!cancelled) console.error('[my-places] load failed', err);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user, refreshKey, internalKey]);

  return {
    favoriteIds,
    notesByAttraction,
    isLoading,
    reload: () => setInternalKey((k) => k + 1),
  };
}
