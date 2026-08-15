import { useCallback, useMemo, useState } from 'react';
import type { Activity } from '../domain-logic/types';
import {
	getActualCurrentWeightOfActivity,
	getProbabilitiesFromActualCurrentWeights,
} from '../domain-logic/weight-logic/preference-to-weight-logic';
import { defaultRng } from '../utils/random-utils';
import { useNow } from './useNow';

export interface LockedActualWeightsApi {
	readonly lockedActualWeightByActivityID: Map<string, number>;
	readonly lockedActualProbabilityByActivityID: Map<string, number>;
	/** Gets a new random actual current weight/probability for every activity. */
	reroll(): void;
}

/**
 * Gets a random actual current weight (and the probability derived from it) for each activity once, and holds it steady across re-renders. A new random value is only gotten again when `reroll()` is called, or when an activity is added or removed.
 */
export function useLockedActualWeights({
	activities,
	spreadFactor,
}: {
	activities: readonly Activity[];
	spreadFactor: number;
}): LockedActualWeightsApi {
	const now = useNow();
	const activityIDSetKey = useMemo(() => activities.map((activity) => activity.id).slice().sort().join(','), [activities]);

	const [rerollNonce, setRerollNonce] = useState(0);
	const reroll = useCallback(() => setRerollNonce((current) => current + 1), []);

	return useMemo<LockedActualWeightsApi>(() => {
		const actualCurrentWeights = activities.map((activity) =>
			getActualCurrentWeightOfActivity({ activity, now, rng: defaultRng }),
		);
		const actualCurrentProbabilities = getProbabilitiesFromActualCurrentWeights({
			actualCurrentWeights,
			spreadFactor,
		});

		const lockedActualWeightByActivityID = new Map<string, number>();
		const lockedActualProbabilityByActivityID = new Map<string, number>();
		activities.forEach((activity, index) => {
			lockedActualWeightByActivityID.set(activity.id, actualCurrentWeights[index]);
			lockedActualProbabilityByActivityID.set(activity.id, actualCurrentProbabilities[index]);
		});

		return { lockedActualWeightByActivityID, lockedActualProbabilityByActivityID, reroll };
		// This intentionally excludes `activities` and `now`, so a reroll only happens when `activityIDSetKey` or `rerollNonce` changes, not on every render.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [activityIDSetKey, rerollNonce, spreadFactor, reroll]);
}
