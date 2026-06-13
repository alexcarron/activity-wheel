/**
 * `useActivities` — single source of truth for the activity list in React.
 *
 * Scoped to a single wheelId. Re-loads whenever the wheelId changes.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  addActivity,
  clearWheelActivities,
  deleteActivity,
  listActivities,
  recordFeedback,
  renameActivity,
  totalEffective,
  updateActivityTags,
} from '../services/activity-service';
import { ensureTagsExist } from '../services/tag-service';
import type { Activity, FeedbackAction } from '../domain-logic/types';

interface UseActivitiesApi {
  readonly activities: readonly Activity[];
  readonly loading: boolean;
  readonly error: string | null;
  add(name: string): Promise<void>;
  rename(id: string, name: string): Promise<void>;
  remove(id: string): Promise<void>;
  feedback(id: string, action: FeedbackAction): Promise<void>;
  updateTags(id: string, tags: string[]): Promise<void>;
  reload(): Promise<void>;
  clearEverything(): Promise<void>;
}

export function useActivities(wheelId: string): UseActivitiesApi {
  const [activities, setActivities] = useState<readonly Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  const wheelRef = useRef(wheelId);
  wheelRef.current = wheelId;

  const reload = useCallback(async (): Promise<void> => {
    try {
      const next = await listActivities(wheelRef.current);
      if (mounted.current) setActivities(next);
    } catch (err) {
      if (mounted.current) setError(toMessage(err));
    }
  }, []);

  // Re-load whenever the wheelId changes.
  useEffect(() => {
    mounted.current = true;
    setLoading(true);
    void (async () => {
      try {
        const next = await listActivities(wheelId);
        if (mounted.current) setActivities(next);
      } catch (err) {
        if (mounted.current) setError(toMessage(err));
      } finally {
        if (mounted.current) setLoading(false);
      }
    })();
    return () => {
      mounted.current = false;
    };
  }, [wheelId]);

  const add = useCallback(
    async (name: string): Promise<void> => {
      try {
        const a = await addActivity(name, wheelRef.current);
        setActivities((prev) => [...prev, a]);
      } catch (err) {
        setError(toMessage(err));
        throw err;
      }
    },
    [],
  );

  const rename = useCallback(async (id: string, name: string): Promise<void> => {
    try {
      const updated = await renameActivity(id, name);
      setActivities((prev) => prev.map((a) => (a.id === id ? updated : a)));
    } catch (err) {
      setError(toMessage(err));
      throw err;
    }
  }, []);

  const remove = useCallback(async (id: string): Promise<void> => {
    try {
      await deleteActivity(id);
      setActivities((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      setError(toMessage(err));
      throw err;
    }
  }, []);

  const updateTags = useCallback(
    async (id: string, tags: string[]): Promise<void> => {
      try {
        const updated = await updateActivityTags(id, tags);
        setActivities((prev) => prev.map((a) => (a.id === id ? updated : a)));
        await ensureTagsExist(wheelRef.current, tags);
      } catch (err) {
        setError(toMessage(err));
        throw err;
      }
    },
    [],
  );

  const feedback = useCallback(
    async (id: string, action: FeedbackAction): Promise<void> => {
      try {
        const poolTotal = totalEffective(activities, Date.now());
        const updated = await recordFeedback(id, action, poolTotal);
        setActivities((prev) => prev.map((a) => (a.id === id ? updated : a)));
      } catch (err) {
        setError(toMessage(err));
        throw err;
      }
    },
    [activities],
  );

  const clearEverything = useCallback(async (): Promise<void> => {
    await clearWheelActivities(wheelRef.current);
    setActivities([]);
  }, []);

  return useMemo<UseActivitiesApi>(
    () => ({
      activities,
      loading,
      error,
      add,
      rename,
      remove,
      feedback,
      updateTags,
      reload,
      clearEverything,
    }),
    [activities, loading, error, add, rename, remove, feedback, updateTags, reload, clearEverything],
  );
}

function toMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
