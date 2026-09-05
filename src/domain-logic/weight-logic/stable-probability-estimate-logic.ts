import type { Activity } from '../types';
import { clamp } from '../../utils/math-utils';
import { getDecayedPreferenceScoreConfidence } from './confidence-decay-logic';
import { getProbabilitiesFromActualCurrentWeights } from './preference-to-weight-logic';
import { MAXIMUM_PREFERENCE_SCORE, MINIMUM_PREFERENCE_SCORE, PREFERENCE_WEIGHT_STRENGTH } from './weight-constants';

/**
 * Determines the expected weight of an activity based on only its preference score and decayed confidence.
 */
export function getStableWeightOfActivity({ activity, now }: { activity: Activity; now: number }): number {
	const decayedPreferenceScoreConfidence = getDecayedPreferenceScoreConfidence({
		preferenceScoreConfidence: activity.preferenceScoreConfidence,
		lastFeedbackAt: activity.lastFeedbackAt,
		now,
	});
	const sanitizedPreferenceScore = clamp(
		Number.isFinite(activity.preferenceScore) ? activity.preferenceScore : 0,
		MINIMUM_PREFERENCE_SCORE,
		MAXIMUM_PREFERENCE_SCORE,
	);
	return Math.exp(
		PREFERENCE_WEIGHT_STRENGTH * sanitizedPreferenceScore +
			(PREFERENCE_WEIGHT_STRENGTH ** 2) / (2 * decayedPreferenceScoreConfidence),
	);
}

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
