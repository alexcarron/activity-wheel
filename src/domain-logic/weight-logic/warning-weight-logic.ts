import type { Activity } from '../types';
import { getEffectiveWeight } from './effective-weight-logic';
import { WEIGHT_DEFAULT } from './weight-constants';
import { getMinimumWeight } from './weight-minimum-logic';
import type { GlobalWeightContext } from './weight-types';

export const WEIGHT_WARNING_THRESHOLD = WEIGHT_DEFAULT / 8;

/**
 * True when the activity's effective weight has fallen to the warning zone, suggesting the user might want to reconsider keeping it. 
 */
export function hasWarningWeight(
	activity: Activity,
	now: number,
	globalWeightContext: GlobalWeightContext,
): boolean {
	const minWeight = getMinimumWeight(activity, globalWeightContext);
	return (
		getEffectiveWeight(activity, now, globalWeightContext) <= minWeight + WEIGHT_WARNING_THRESHOLD
	);
}
