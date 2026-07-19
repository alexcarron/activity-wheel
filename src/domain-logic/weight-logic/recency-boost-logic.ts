/**
 * Logic for the temporary weight bonus for newly added activities
 */
import type { Activity } from '../types';
import type { GlobalWeightContext } from './weight-types';

export const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

const RECENCY_BOOST_DURATION_DAYS = 7;
const RECENCY_BOOST_FRACTION_OF_POOL_AVERAGE_WEIGHT = 0.3;
const RECENCY_BOOST_FALLBACK_WEIGHT_WHEN_NO_POOL_CONTEXT = 30;

const IS_RECENCY_BOOST_ENABLED = true;

/**
 * Returns the recency bonus (in weight points) for given activity at the current time
 */
export function getRecencyWeightBoost(
	activity: Activity,
	now: number,
	globalWeightContext: GlobalWeightContext,
): number {
	if (!IS_RECENCY_BOOST_ENABLED) return 0;

	const daysSinceCreated = (now - activity.createdAt) / MILLISECONDS_PER_DAY;

	if (daysSinceCreated < 0 || daysSinceCreated >= RECENCY_BOOST_DURATION_DAYS) return 0;

	const elapsedFullDays = Math.floor(daysSinceCreated);
	const boostPercentage = 1 - elapsedFullDays / RECENCY_BOOST_DURATION_DAYS;

	if (
		globalWeightContext.totalEffectiveWeight !== undefined &&
		globalWeightContext.numTotalActivities !== undefined &&
		globalWeightContext.numTotalActivities > 0
	) {
		const avgWeight =
			globalWeightContext.totalEffectiveWeight / globalWeightContext.numTotalActivities;
		return avgWeight * (RECENCY_BOOST_FRACTION_OF_POOL_AVERAGE_WEIGHT * boostPercentage);
	}

	return RECENCY_BOOST_FALLBACK_WEIGHT_WHEN_NO_POOL_CONTEXT * boostPercentage;
}
