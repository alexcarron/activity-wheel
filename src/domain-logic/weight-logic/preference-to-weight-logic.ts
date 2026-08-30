import type { Activity } from '../types';
import type { Rng } from '../../utils/random-utils';
import { sampleStandardNormal } from '../../utils/random-utils';
import { getDecayedPreferenceScoreConfidence } from './confidence-decay-logic';
import { applySpreadToWeights } from './weight-spread-logic';
import { PREFERENCE_WEIGHT_STRENGTH } from './weight-constants';

export function getPreferenceScoreStandardDeviation(decayedPreferenceScoreConfidence: number): number {
	return 1 / Math.sqrt(decayedPreferenceScoreConfidence);
}

/**
 * Gets one possible preference score for this exact spin.
 */
export function getPossiblePreferenceScore({ activity, now, rng }: { activity: Activity; now: number; rng: Rng }): number {
	const decayedPreferenceScoreConfidence = getDecayedPreferenceScoreConfidence({
		preferenceScoreConfidence: activity.preferenceScoreConfidence,
		lastFeedbackAt: activity.lastFeedbackAt,
		now,
	});
	const standardDeviation = getPreferenceScoreStandardDeviation(decayedPreferenceScoreConfidence);
	return activity.preferenceScore + sampleStandardNormal(rng) * standardDeviation;
}

export function getWeightOfPossiblePreferenceScore(possiblePreferenceScore: number): number {
	return Math.exp(possiblePreferenceScore * PREFERENCE_WEIGHT_STRENGTH);
}

/**
 * Determines the expected weight of an activity based on only its preference score and decayed confidence.
 */
export function getStableWeightOfActivity({ activity, now }: { activity: Activity; now: number }): number {
	const decayedPreferenceScoreConfidence = getDecayedPreferenceScoreConfidence({
		preferenceScoreConfidence: activity.preferenceScoreConfidence,
		lastFeedbackAt: activity.lastFeedbackAt,
		now,
	});
	return Math.exp(
		PREFERENCE_WEIGHT_STRENGTH * activity.preferenceScore +
			(PREFERENCE_WEIGHT_STRENGTH ** 2) / (2 * decayedPreferenceScoreConfidence),
	);
}

/**
 * A random weight for one activity for one specific spin. A fresh call gets a new random value, so callers that need this value to stay the same across renders must call it once and hold onto the result themselves. Use the estimated stable weight/probability for anything that should look steady.
 */
export function getActualCurrentWeightOfActivity({ activity, now, rng }: { activity: Activity; now: number; rng: Rng }): number {
	return getWeightOfPossiblePreferenceScore(getPossiblePreferenceScore({ activity, now, rng }));
}

/**
 * Turns already-picked actual current weights into normalized selection probabilities, parallel to the given weights. Includes the debug weight spread, matching how a real spin selects. Takes no randomness itself, so the result always matches whatever weights were passed in.
 */
export function getProbabilitiesFromActualCurrentWeights({ actualCurrentWeights, spreadFactor }: { actualCurrentWeights: readonly number[]; spreadFactor: number }): number[] {
	if (actualCurrentWeights.length === 0) return [];
	const spreadWeights = applySpreadToWeights(actualCurrentWeights, spreadFactor);
	const totalWeight = spreadWeights.reduce((sum, weight) => sum + weight, 0);
	if (totalWeight <= 0) return actualCurrentWeights.map(() => 0);
	return spreadWeights.map((weight) => weight / totalWeight);
}

/**
 * The normalized selection probabilities for one exact spin, parallel to the given activities. Gets a fresh random weight for each activity, so a new call gets new values. Use `getProbabilitiesFromActualCurrentWeights` instead when the weights are already known.
 */
export function getActualCurrentProbabilities({ activities, now, rng, spreadFactor }: { activities: readonly Activity[]; now: number; rng: Rng; spreadFactor: number }): number[] {
	if (activities.length === 0) return [];
	const actualCurrentWeights = activities.map((activity) => getActualCurrentWeightOfActivity({ activity, now, rng }));
	return getProbabilitiesFromActualCurrentWeights({ actualCurrentWeights, spreadFactor });
}
