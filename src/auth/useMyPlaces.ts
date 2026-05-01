import { useEffect, useState } from 'react';
import { pb } from './pb';
import { useAuth } from './AuthProvider';
import type { NoteRecord } from './useNotes';

interface MyPlacesState {
  favoriteIds: Set<string>;
  notesByAttraction: Map<string, NoteRecord[]>;
  isLoading: boolean;
}

export function useMyPlaces(refreshKey: number = 0): MyPlacesState {
  const { user } = useAuth();
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [notesByAttraction, setNotesByAttraction] = useState<Map<string, NoteRecord[]>>(new Map());
  const [isLoading, setIsLoading] = useState(false);

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
      pb.collection('notes').getFullList<NoteRecord>({
        filter: `user = "${user.id}"`,
        sort: '-created',
      }),
    ])
      .then(([favs, notes]) => {
        if (cancelled) return;
        setFavoriteIds(new Set(favs.map((f) => f.attraction_id)));
        const grouped = new Map<string, NoteRecord[]>();
        for (const n of notes) {
          const list = grouped.get(n.attraction_id);
          if (list) list.push(n);
          else grouped.set(n.attraction_id, [n]);
        }
        setNotesByAttraction(grouped);
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
  }, [user, refreshKey]);

  return { favoriteIds, notesByAttraction, isLoading };
}
