/**
 * Logic for the diminishing-returns factor for both positive and negative weight changes
 */
import type { Activity } from '../types';
import { getMaximumWeight } from './weight-maximum-logic';
import { getMinimumWeight } from './weight-minimum-logic';
import type { GlobalWeightContext } from './weight-types';

const DIMINISHING_RETURNS_CURVE_EXPONENT = 0.7;
const MINIMUM_DIMINISHING_RETURNS_FACTOR = 0.1;

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
	const possibleWeightSpan = maxWeight - minWeight;
	const weightLeftToGrow = maxWeight - weight;
	const weightLeftToShrink = weight - minWeight;
	const distanceToExtremeWeight =
		direction === 'positive'
			? weightLeftToGrow
			: weightLeftToShrink;

	const ratio = Math.max(0, Math.min(1, distanceToExtremeWeight / possibleWeightSpan));
	return Math.max(MINIMUM_DIMINISHING_RETURNS_FACTOR, Math.pow(ratio, DIMINISHING_RETURNS_CURVE_EXPONENT));
}
