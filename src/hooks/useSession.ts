/**
 * `useSession`. Tracks which activities have already been spun this session.
 * State lives only in memory; reload = fresh session, by design. The remaining activities are computed on demand from the full activity list and the excluded id set.
 */

import { useCallback, useMemo, useState } from 'react';
import type { Activity } from '../domain-logic/types';

export interface SessionApi {
	/** Activities still available to spin this session. */
	readonly remainingActivities: readonly Activity[];
	/** Set of ids of activities excluded from the rest of this session. */
	readonly excludedActivities: ReadonlySet<string>;
	/** Marks an activity as spun after a spin */
	excludeActivity(activityID: string): void;
	/** Resets all activities to not be excluded */
	resetExcludedActivities(): void;
}

export function useSession(activities: readonly Activity[]): SessionApi {
	const [excluded, setExcluded] = useState<ReadonlySet<string>>(() => new Set());

	const remainingActivities = useMemo<readonly Activity[]>(
		() => activities.filter((activity) => !excluded.has(activity.id)),
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
		() => ({ remainingActivities, excludedActivities: excluded, excludeActivity: exclude, resetExcludedActivities: reset }),
		[remainingActivities, excluded, exclude, reset],
	);
}
