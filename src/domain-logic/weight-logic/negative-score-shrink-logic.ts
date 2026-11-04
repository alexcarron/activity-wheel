import { INITIAL_PREFERENCE_SCORE_CONFIDENCE, NEGATIVE_PREFERENCE_SCORE_SHRINK_MULTIPLIER } from './weight-constants';

/** Applies the one-time fix for negative preference scores, leaving other scores untouched. */
export function shrinkNegativePreferenceEstimate<EstimateHolder extends { preferenceScore: number; preferenceScoreConfidence: number }>(
	estimateHolder: EstimateHolder,
): EstimateHolder {
	if (!(estimateHolder.preferenceScore < 0)) return estimateHolder;
	return {
		...estimateHolder,
		preferenceScore: estimateHolder.preferenceScore * NEGATIVE_PREFERENCE_SCORE_SHRINK_MULTIPLIER,
		preferenceScoreConfidence: INITIAL_PREFERENCE_SCORE_CONFIDENCE,
	};
}
