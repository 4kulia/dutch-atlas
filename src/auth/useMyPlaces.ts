import { useEffect, useState } from 'react';
import { apiFetch } from './api';
import { useAuth } from './AuthProvider';
import type { NoteRecord } from './useNotes';

interface MyPlacesState {
  favoriteIds: Set<string>;
  visitedIds: Set<string>;
  notesByAttraction: Map<string, NoteRecord[]>;
  isLoading: boolean;
}

interface ApiNote {
  id: string;
  body: string;
  created_at: string;
  attraction_id: string;
}

export function useMyPlaces(refreshKey: number = 0): MyPlacesState {
  const { user } = useAuth();
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [visitedIds, setVisitedIds] = useState<Set<string>>(new Set());
  const [notesByAttraction, setNotesByAttraction] = useState<Map<string, NoteRecord[]>>(new Map());
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      setFavoriteIds(new Set());
      setVisitedIds(new Set());
      setNotesByAttraction(new Map());
      return;
    }
    let cancelled = false;
    setIsLoading(true);

    Promise.all([
      apiFetch<{ favorites: Array<{ attractionId: string }> }>('/api/favorites'),
      apiFetch<{ visits: Array<{ attractionId: string }> }>('/api/visits'),
      apiFetch<{ notes: ApiNote[] }>('/api/notes'),
    ])
      .then(([favs, visits, notes]) => {
        if (cancelled) return;
        setFavoriteIds(new Set(favs.favorites.map((f) => f.attractionId)));
        setVisitedIds(new Set(visits.visits.map((v) => v.attractionId)));
        const grouped = new Map<string, NoteRecord[]>();
        for (const n of notes.notes) {
          const rec: NoteRecord = {
            id: n.id,
            body: n.body,
            created: n.created_at,
            attraction_id: n.attraction_id,
          };
          const list = grouped.get(n.attraction_id);
          if (list) list.push(rec);
          else grouped.set(n.attraction_id, [rec]);
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

  return { favoriteIds, visitedIds, notesByAttraction, isLoading };
}
