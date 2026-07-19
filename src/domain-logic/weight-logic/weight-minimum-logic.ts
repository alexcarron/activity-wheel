/**
 * Logic for determining the minimum weight of an activity based on all existing activities.
 */
import type { Activity } from '../types';
import type { GlobalWeightContext } from './weight-types';

export const WEIGHT_HARD_MINIMUM = 1;

export const EST_SPINS_PER_MONTH = 300;

/**
 * The minimum probability an item must have to appear at least once in the estimated monthly spins 
 */
export const MIN_PROBABILITY_SHOWN_PER_MONTH = 0.5;

/**
 * The minimum probability an item must have so that it appears at least once in the estimated monthly spins with ≥50% probability if the number of items total is small enough. 
 */
export const MIN_PROBABILITY_FOR_SMALL_ITEM_TOTAL =
	-Math.log(1 - MIN_PROBABILITY_SHOWN_PER_MONTH) / EST_SPINS_PER_MONTH;

/**
 * Get the expected fraction of distinct items you'll see in a month's worth of spins assuming every item has the same probability of being seen.
 * @param numTotalItems - the total number of items in the pool
 * @returns the expected fraction of distinct items seen in a month of spins 
 */
export const getPercentageItemsSeenInMonth = (numTotalItems: number) =>
	1 - Math.exp(-EST_SPINS_PER_MONTH / numTotalItems);

export const getNumItemsSeenInMonth = (numTotalItems: number) =>
	getPercentageItemsSeenInMonth(numTotalItems) * numTotalItems;

export const getMinProbabilityForLargeItemTotal = (numTotalItems: number) =>
	getPercentageItemsSeenInMonth(numTotalItems) * MIN_PROBABILITY_FOR_SMALL_ITEM_TOTAL;

/**
 * Returns the minimum selection probability any item must hold.
 * @param numItems - Total number of activities in the pool. 
 */
export function computeMinimumProbability(numItems: number): number {
	if (numItems <= 0) return MIN_PROBABILITY_FOR_SMALL_ITEM_TOTAL;

	const minProbabilityForLargeItemTotal = getMinProbabilityForLargeItemTotal(numItems);
	return Math.min(MIN_PROBABILITY_FOR_SMALL_ITEM_TOTAL, minProbabilityForLargeItemTotal);
}

/**
 * Converts a minimum probability into a minimum weight, given the total effective weight.
 * @param minProbability - Minimum probability
 * @param totalEffectiveWeight - Sum of all activities' effective weights. 
 */
export function probabilityToWeight(minProbability: number, totalEffectiveWeight: number): number {
	return minProbability * totalEffectiveWeight;
}

/**
 * Returns the minimum effective weight this activity must have so it remains visible over a typical month of spins.
 * @param _activity - The activity being evaluated
 * @param globalWeightContext - Information about the pool's current total effective weight and number of activities. 
 */
export function getMinimumWeight(
	_activity: Activity,
	globalWeightContext: GlobalWeightContext,
): number {
	const { numTotalActivities, totalEffectiveWeight } = globalWeightContext;

	if (!numTotalActivities || !totalEffectiveWeight || totalEffectiveWeight <= 0) {
		return WEIGHT_HARD_MINIMUM;
	}

	const minProbability = computeMinimumProbability(numTotalActivities);
	const minWeight = probabilityToWeight(minProbability, totalEffectiveWeight);

	return Math.max(WEIGHT_HARD_MINIMUM, minWeight);
}
