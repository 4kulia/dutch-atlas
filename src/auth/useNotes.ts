import { useCallback, useEffect, useState } from 'react';
import { pb } from './pb';
import { useAuth } from './AuthProvider';

export interface NoteRecord {
  id: string;
  user: string;
  attraction_id: string;
  body: string;
  created: string;
  updated: string;
}

interface NotesState {
  notes: NoteRecord[];
  isLoading: boolean;
  isSaving: boolean;
  add: (body: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export function useNotes(attractionId: string | null): NotesState {
  const { user } = useAuth();
  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!user || !attractionId) {
      setNotes([]);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    pb.collection('notes')
      .getFullList<NoteRecord>({
        filter: `user = "${user.id}" && attraction_id = "${attractionId}"`,
        sort: '-created',
      })
      .then((records) => {
        if (!cancelled) setNotes(records);
      })
      .catch((err) => {
        if (!cancelled) console.error('[notes] load failed', err);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, attractionId]);

  const add = useCallback(
    async (body: string) => {
      const trimmed = body.trim();
      if (!user || !attractionId || !trimmed) return;
      setIsSaving(true);
      try {
        const created = await pb.collection('notes').create<NoteRecord>({
          user: user.id,
          attraction_id: attractionId,
          body: trimmed,
        });
        setNotes((prev) => [created, ...prev]);
      } catch (err) {
        console.error('[notes] add failed', err);
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    [user, attractionId],
  );

  const remove = useCallback(async (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    try {
      await pb.collection('notes').delete(id);
    } catch (err) {
      console.error('[notes] delete failed', err);
      // Reload to recover the canonical state on error.
      if (user && attractionId) {
        try {
          const refreshed = await pb.collection('notes').getFullList<NoteRecord>({
            filter: `user = "${user.id}" && attraction_id = "${attractionId}"`,
            sort: '-created',
          });
          setNotes(refreshed);
        } catch {}
      }
    }
  }, [user, attractionId]);

  return { notes, isLoading, isSaving, add, remove };
}
