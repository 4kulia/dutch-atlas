import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from './api';
import { useAuth } from './AuthProvider';

export interface NoteRecord {
  id: string;
  body: string;
  // Server returns ISO-8601 strings (Postgres timestamptz). We keep the name
  // `created` for parity with the prior UI components.
  created: string;
  attraction_id: string;
}

interface ApiNote {
  id: string;
  body: string;
  created_at: string;
  attraction_id: string;
}

function fromApi(n: ApiNote): NoteRecord {
  return { id: n.id, body: n.body, created: n.created_at, attraction_id: n.attraction_id };
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
    const params = new URLSearchParams({ attractionId });
    apiFetch<{ notes: ApiNote[] }>(`/api/notes?${params}`)
      .then((res) => {
        if (!cancelled) setNotes(res.notes.map(fromApi));
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
        const res = await apiFetch<{ note: ApiNote }>('/api/notes', {
          method: 'POST',
          body: JSON.stringify({ attractionId, body: trimmed }),
        });
        setNotes((prev) => [fromApi(res.note), ...prev]);
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
      await apiFetch(`/api/notes/${id}`, { method: 'DELETE' });
    } catch (err) {
      console.error('[notes] delete failed', err);
    }
  }, []);

  return { notes, isLoading, isSaving, add, remove };
}
