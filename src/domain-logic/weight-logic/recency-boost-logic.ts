/**
 * Recency boost. A temporary weight bonus for newly added activities.
 * Purpose: ensure new activities actually get sampled in the first week without requiring the user to manually boost them.
 * Formula: boost = baseBoost × (1 − days / RECENCY_DAYS)   [linear fade to 0]
 * baseBoost is derived from pool context when available: baseBoost = poolAvgWeight × RECENCY_BOOST_MULTIPLIER
 * This means the bonus scales with the rest of the pool. If existing activities have drifted high through lots of accepts, the new activity still gets a proportionally competitive head-start.
 * Falls back to RECENCY_BOOST_AVG_WEIGHT_FALLBACK (flat points) when no pool context is supplied (first-ever activity, unit tests, debug panel). 
 */

import type { Activity } from '../types';
import {
	DAY_MS,
	RECENCY_BOOST_AVG_WEIGHT_FALLBACK,
	RECENCY_BOOST_MULTIPLIER,
	RECENCY_BOOST_DURATION_DAYS,
} from './weight-constants';
import type { GlobalWeightContext } from './weight-types';

const IS_RECENCY_BOOST_ENABLED = false; // Set to false to disable the recency boost feature entirely (for testing purposes).

/**
 * Returns the recency bonus (in weight points) for `activity` at time `now`. Returns 0 once the activity is older than RECENCY_DAYS. 
 */
export function getRecencyWeightBoost(
	activity: Activity,
	now: number,
	globalWeightContext: GlobalWeightContext,
): number {
	if (!IS_RECENCY_BOOST_ENABLED) return 0;

	const daysSinceCreated = (now - activity.createdAt) / DAY_MS;

	// Outside the window (or clock skew) → no boost.
	if (daysSinceCreated < 0 || daysSinceCreated >= RECENCY_BOOST_DURATION_DAYS) return 0;

	const boostPercentage = 1 - daysSinceCreated / RECENCY_BOOST_DURATION_DAYS; // 1.0 on day 0 → 0.0 on day 7

	if (
		globalWeightContext.totalEffectiveWeight !== undefined &&
		globalWeightContext.numTotalActivities !== undefined &&
		globalWeightContext.numTotalActivities > 0
	) {
		const avgWeight =
			globalWeightContext.totalEffectiveWeight / globalWeightContext.numTotalActivities;
		return avgWeight * (RECENCY_BOOST_MULTIPLIER * boostPercentage);
	}

	return RECENCY_BOOST_AVG_WEIGHT_FALLBACK * boostPercentage;
}
