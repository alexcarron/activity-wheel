import type { Activity } from "../types";
import { WEIGHT_DEFAULT } from "./weight-constants";
import type { GlobalWeightContext } from "./weight-types";

export const WEIGHT_HARD_MAXIMUM = WEIGHT_DEFAULT * 100;

export const MAX_PROBABILITY = 0.5;

export const getMaxWeightFromProbability = (probability: number, totalEffectiveWeight: number): number => {
	if (probability <= 0) return 0;
	if (probability >= MAX_PROBABILITY) return totalEffectiveWeight;
	return probability * totalEffectiveWeight;
};

/**
 * Returns the maximum effective weight this activity can have based on its probability.
 * @param _activity - The activity being evaluated
 * @param globalWeightContext - Information about the pool's current total effective weight and number of activities.
 */
export function getMaximumWeight(
  activity: Activity,
  globalWeightContext: GlobalWeightContext,
): number {
  const { numTotalActivities, totalEffectiveWeight } = globalWeightContext;

	if (totalEffectiveWeight !== undefined) {
		const totalWeightWithoutActivity = totalEffectiveWeight - activity.weight;
		return totalWeightWithoutActivity * (MAX_PROBABILITY / (1 - MAX_PROBABILITY));
	}

	if (numTotalActivities !== undefined)
		return WEIGHT_DEFAULT * numTotalActivities * MAX_PROBABILITY;

	return WEIGHT_HARD_MAXIMUM;
}

/**
 * Checks if the activity's weight exceeds the maximum weight based on its probability.
 * @param activity - The activity being evaluated
 * @param globalWeightContext - Information about the pool's current total effective weight and number of activities.
 * @returns true if the activity's weight exceeds the maximum weight, false otherwise.
 */
export function isPastMaxWeight(activity: Activity, globalWeightContext: GlobalWeightContext): boolean {
	const maxWeight = getMaximumWeight(activity, globalWeightContext);
	return activity.weight > maxWeight;
}