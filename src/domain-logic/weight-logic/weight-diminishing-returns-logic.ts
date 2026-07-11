/**
 * Diminishing-returns factor for weight changes.
 * Rationale: as a weight approaches its bound (MAX for positive changes, MIN for negative changes), the effective step size shrinks. This prevents weights from slamming hard into the ceiling or floor, and makes the curve feel natural. Early feedback has more impact than feedback at extremes.
 * Formula: ratio    = distance_to_bound / (MAX − MIN)        [0 = at bound, 1 = far away] factor   = max(FLOOR, ratio ^ EXPONENT)
 * At the midpoint from either bound, factor ≈ 0.62 (with exponent 0.7). At the bound itself, factor = FLOOR (default 0.1). A tiny nudge still fires. 
 */

import type { Activity } from '../types';
import { DIMINISHING_EXPONENT, DIMINISHING_FLOOR } from './weight-constants';
import { getMaximumWeight } from './weight-maximum-logic';
import { getMinimumWeight } from './weight-minimum-logic';
import type { GlobalWeightContext } from './weight-types';

/**
 * Returns the diminishing-returns scale factor as a percentage for a given activity
 * @param activity - The activity being modified.
 * @param direction - 'positive' = moving toward MAX, 'negative' = toward MIN. 
 */
export function getDiminishingFactor(
	activity: Activity,
	direction: 'positive' | 'negative',
	globalWeightContext: GlobalWeightContext,
): number {
	const weight = activity.weight;
	const minWeight = getMinimumWeight(activity, globalWeightContext);
	const maxWeight = getMaximumWeight(activity, globalWeightContext);
	const span = maxWeight - minWeight;
	const distance =
		direction === 'positive'
			? maxWeight - weight // room left to grow
			: weight - minWeight; // room left to fall

	const ratio = Math.max(0, Math.min(1, distance / span));
	return Math.max(DIMINISHING_FLOOR, Math.pow(ratio, DIMINISHING_EXPONENT));
}
