/**
 * Weight logic barrel export
 * Central export point for all weight-related functions and types.
 */

export { getEffectiveWeight as getEffectiveWeight } from './effective-weight-logic';
export { applyFeedback } from './weight-feedback-response-logic';
export { newActivity } from '../activity-logic/activity-factory';
export {
  ACCEPT_STEP,
  BOOST_STEP,
  DOMINANCE_GUARD,
  REJECT_STEP,
  WEIGHT_DEFAULT,
	DAY_MS,
} from './weight-constants';
export { getRecencyWeightBoost as recencyBoost } from './recency-boost-logic';
export { getMomentumInfoFor as momentumFor } from './weight-momentum-logic';
export { getDiminishingFactor as diminishingFactor } from './weight-diminishing-returns-logic';
export { hasWarningWeight, hasWarningWeight as isLowWeight } from './warning-weight-logic';
export type { GlobalWeightContext } from './weight-types';
