import { useCallback, useEffect, useState } from 'react';
import { ApiError, apiFetch } from './api';
import { useAuth } from './AuthProvider';

interface VisitsResponse {
  visits: Array<{ attractionId: string; createdAt: string }>;
}

interface VisitsState {
  ids: Set<string>;
  isLoading: boolean;
  toggle: (attractionId: string) => Promise<void>;
}

export function useVisits(): VisitsState {
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
    apiFetch<VisitsResponse>('/api/visits')
      .then((res) => {
        if (!cancelled) setIds(new Set(res.visits.map((v) => v.attractionId)));
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) return;
        console.error('[visits] load failed', err);
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
      const wasVisited = ids.has(attractionId);
      const next = new Set(ids);
      if (wasVisited) next.delete(attractionId);
      else next.add(attractionId);
      setIds(next); // optimistic
      try {
        await apiFetch('/api/visits', {
          method: 'POST',
          body: JSON.stringify({ attractionId, state: wasVisited ? 'off' : 'on' }),
        });
      } catch (err) {
        setIds(ids); // rollback
        console.error('[visits] toggle failed', err);
      }
    },
    [user, ids],
  );

  return { ids, isLoading, toggle };
}
