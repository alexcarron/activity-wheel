import type { Activity } from '../types';
import { getStableWeightOfActivity, getProbabilitiesFromActualCurrentWeights } from './preference-to-weight-logic';

/**
 * Determines the expected weight of each activity.
 */
export function estimateStableWeights({ activities, now }: { activities: readonly Activity[]; now: number }): number[] {
	return activities.map((activity) => getStableWeightOfActivity({ activity, now }));
}

/**
 * Determines the expected selection probability of each activity. 
 * Includes the debug weight spread.
 */
export function estimateStableProbabilities({ activities, now, spreadFactor }: { activities: readonly Activity[]; now: number; spreadFactor: number }): number[] {
	const stableWeights = estimateStableWeights({ activities, now });
	return getProbabilitiesFromActualCurrentWeights({ actualCurrentWeights: stableWeights, spreadFactor });
}
