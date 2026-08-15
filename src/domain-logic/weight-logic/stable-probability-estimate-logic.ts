/**
 * Stable estimates of each activity's weight and selection probability. Both repeat the full per-spin procedure many times and average the result, so they return a steady number instead of the actual current value that changes every spin. Used for the debug pills and for sizing the wheel's slices.
 */
import type { Activity } from '../types';
import type { Rng } from '../../utils/random-utils';
import { getActualCurrentWeightOfActivity } from './preference-to-weight-logic';
import { applySpreadToWeights } from './weight-spread-logic';

export const DEFAULT_ESTIMATION_SAMPLE_COUNT = 200;

/**
 * Estimates each activity's stable selection probability, parallel to the given activities. Includes the debug weight spread, matching how a real spin selects. Returns an all-zero array for no activities.
 */
export function estimateStableProbabilities({
	activities,
	now,
	rng,
	spreadFactor,
	sampleCount = DEFAULT_ESTIMATION_SAMPLE_COUNT,
}: {
	activities: readonly Activity[];
	now: number;
	rng: Rng;
	spreadFactor: number;
	sampleCount?: number;
}): number[] {
	const shareTotals = new Array<number>(activities.length).fill(0);
	if (activities.length === 0) return shareTotals;

	for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex++) {
		const actualCurrentWeights = activities.map((activity) => getActualCurrentWeightOfActivity({ activity, now, rng }));
		const spreadWeights = applySpreadToWeights(actualCurrentWeights, spreadFactor);
		const totalWeight = spreadWeights.reduce((sum, weight) => sum + weight, 0);
		if (totalWeight <= 0) continue;
		spreadWeights.forEach((weight, index) => {
			shareTotals[index] += weight / totalWeight;
		});
	}

	return shareTotals.map((total) => total / sampleCount);
}

/**
 * Estimates each activity's stable weight, parallel to the given activities. This is the average raw weight the activity gets, before the debug weight spread. Returns an all-zero array for no activities.
 */
export function estimateStableWeights({
	activities,
	now,
	rng,
	sampleCount = DEFAULT_ESTIMATION_SAMPLE_COUNT,
}: {
	activities: readonly Activity[];
	now: number;
	rng: Rng;
	sampleCount?: number;
}): number[] {
	const weightTotals = new Array<number>(activities.length).fill(0);
	if (activities.length === 0) return weightTotals;

	for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex++) {
		activities.forEach((activity, index) => {
			weightTotals[index] += getActualCurrentWeightOfActivity({ activity, now, rng });
		});
	}

	return weightTotals.map((total) => total / sampleCount);
}
