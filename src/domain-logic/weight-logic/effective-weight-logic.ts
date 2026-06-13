/**
 * Effective weight — the value actually used for selection probabilities
 * and UI display.
 *
 * Effective weight = stored weight + recency boost (if within 7 days).
 *
 * The recency boost is context-aware when pool info is available, so new
 * activities scale appropriately against the existing crowd.
 *
 * Always returns at least WEIGHT_MIN so every activity has a non-zero chance
 * of being selected — nothing is permanently unspinnable.
 *
 * NOTE: Daily decay has been removed. The stored weight is the permanent
 * baseline; it only changes through explicit user feedback (accept/reject/
 * boost/undo).
 */

import type { Activity } from '../types';
import { getRecencyWeightBoost } from './recency-boost-logic';
import type { GlobalWeightContext } from './weight-types';
import { getMinimumWeight } from './weight-minimum-logic';
import { getMaximumWeight } from './weight-maximum-logic';

/**
 * Gets the effective weight used for wheel selection and probability display.
 * Optionally accepts pool context to compute a more accurate recency boost.
 */
export function getEffectiveWeight(
  activity: Activity,
  now: number,
  globalWeightContext: GlobalWeightContext,
): number {
  const recencyWeightBoost = getRecencyWeightBoost(activity, now, globalWeightContext);
  // Recency can push a new activity above MAX temporarily — that's intentional
  // and transient. MIN floor guarantees every activity stays in the game.
	const effectiveWeight = activity.weight + recencyWeightBoost;
	const minEffectiveWeight = getMinimumWeight(activity, globalWeightContext);
	const maxEffectiveWeight = getMaximumWeight(activity, globalWeightContext);
	return Math.max(minEffectiveWeight, Math.min(effectiveWeight, maxEffectiveWeight));
}
