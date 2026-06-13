/**
 * Capacity-aware minimum weight guarantee.
 *
 * Goal: every activity should have a reasonable chance of appearing over a
 * typical month of spins — without imposing mathematically impossible
 * constraints when the pool is large.
 *
 * For each activity, we compute a minimum *probability* it must hold:
 *   p_min = min(
 *     ln(2) / SPINS,           ← "50% visibility" threshold (~0.00231 for 300 spins)
 *     SAMPLING_FACTOR / N      ← "sampling fairness" threshold
 *   )
 *
 * Then convert back to a minimum weight:
 *
 *   w_min = p_min × totalEffectiveWeight
 *
 * The visibility term (ln(2)/SPINS) is the ideal: every item appears at least
 * once with ≥50% probability over the reference period. This is mathematically
 * impossible when the pool is large enough (> ~433 items for 300 spins), so the
 * sampling-fairness term (c/N) kicks in as a graceful fallback. It guarantees
 * that no item can be more than 1/c times less likely than a uniform pick.
 *
 *   MIN_VISIBILITY_SPINS           — reference spin count (default 300)
 *   MIN_VISIBILITY_PROBABILITY     — derived from above; do not edit directly
 *   MIN_VISIBILITY_SAMPLING_FACTOR — fairness factor c (default 0.25)
 *
 * If pool context is unavailable (unit tests, isolated calls) the function
 * returns WEIGHT_MIN so the hard floor still applies.
 */

import type { Activity } from '../types';
import type { GlobalWeightContext } from './weight-types';

/**
 * The absolute minimum weight any activity can have, regardless of pool context.
 */
export const WEIGHT_HARD_MINIMUM = 1;

/**
 * The number of spins estimated to be done in a typical month of user activity.
 * Reference number of spins used for the visibility guarantee.
 */
export const EST_SPINS_PER_MONTH = 300;

/**
 * The minimum probability an item must have to appear at least once in the estimated monthly spins
 */
export const MIN_PROBABILITY_SHOWN_PER_MONTH = 0.5;

/**
 * The minimum probability an item must have so that it appears at least once in the estimated monthly spins with ≥50% probability if the number of items total is small enough.
 */
export const MIN_PROBABILITY_FOR_SMALL_ITEM_TOTAL = -Math.log(1 - MIN_PROBABILITY_SHOWN_PER_MONTH) / EST_SPINS_PER_MONTH;

/**
 * Get the expected fraction of distinct items you'll see in a month's worth of spins assuming every item has the same probability of being seen.
 * @param numTotalItems - the total number of items in the pool
 * @returns the expected fraction of distinct items seen in a month of spins
 */
export const getPercentageItemsSeenInMonth = 
	(numTotalItems: number) => 1 - Math.exp(-EST_SPINS_PER_MONTH / numTotalItems);

export const getNumItemsSeenInMonth = (numTotalItems: number) => 
	getPercentageItemsSeenInMonth(numTotalItems) * numTotalItems;

export const getMinProbabilityForLargeItemTotal = (numTotalItems: number) => 
	getPercentageItemsSeenInMonth(numTotalItems) * MIN_PROBABILITY_FOR_SMALL_ITEM_TOTAL;

/**
 * Returns the minimum selection probability any item must hold.
 * Switches automatically between:
 *  - the "50% monthly visibility" guarantee for small / medium pools, and
 *  - a "sampling fairness" floor for large pools where full visibility is
 *    mathematically impossible.
 * @param numItems Total number of activities in the pool.
 */
export function computeMinimumProbability(numItems: number): number {
  if (numItems <= 0) return MIN_PROBABILITY_FOR_SMALL_ITEM_TOTAL;

  const minProbabilityForLargeItemTotal = getMinProbabilityForLargeItemTotal(numItems);
  return Math.min(MIN_PROBABILITY_FOR_SMALL_ITEM_TOTAL, minProbabilityForLargeItemTotal);
}

/**
 * Converts a minimum probability into a minimum weight, given the  total effective weight.
 * @param minProbability - Minimum probability (from computeMinimumProbability).
 * @param totalEffectiveWeight - Sum of all activities' effective weights.
 */
export function probabilityToWeight(minProbability: number, totalEffectiveWeight: number): number {
  return minProbability * totalEffectiveWeight;
}

/**
 * Returns the minimum effective weight this activity must have so it remains visible over a typical month of spins.
 * @param _activity - The activity being evaluated (reserved for future per-activity overrides, e.g. pinned favourites).
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
