/**
 * `useSession` — tracks which activities have already been spun this session.
 *
 * State lives only in memory; reload = fresh session, by design. The session
 * pool is computed on demand from the full activity list and the excluded id
 * set.
 */

import { useCallback, useMemo, useState } from 'react';
import type { Activity } from '../domain-logic/types';

export interface SessionApi {
  /** Activities still available to spin this session. */
  readonly pool: readonly Activity[];
  /** Set of activity ids excluded from the rest of this session. */
  readonly excluded: ReadonlySet<string>;
  /** Mark an id as spun (call after every spin, regardless of feedback). */
  exclude(id: string): void;
  /** Drop everything from the excluded set. */
  reset(): void;
}

export function useSession(activities: readonly Activity[]): SessionApi {
  const [excluded, setExcluded] = useState<ReadonlySet<string>>(() => new Set());

  const pool = useMemo<readonly Activity[]>(
    () => activities.filter((a) => !excluded.has(a.id)),
    [activities, excluded],
  );

  const exclude = useCallback((id: string): void => {
    setExcluded((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const reset = useCallback((): void => {
    setExcluded((prev) => (prev.size === 0 ? prev : new Set()));
  }, []);

  return useMemo<SessionApi>(
    () => ({ pool, excluded, exclude, reset }),
    [pool, excluded, exclude, reset],
  );
}
