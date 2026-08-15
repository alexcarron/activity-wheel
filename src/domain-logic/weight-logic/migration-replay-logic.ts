/**
 * One-time migration from the old weight system's acceptCount/rejectCount into a preference estimate.
 */
import { INITIAL_PREFERENCE_SCORE_CONFIDENCE, MIGRATION_PREVIOUS_FEEDBACK_STRENGTH } from './weight-constants';

export interface MigratedPreferenceEstimate {
	preferenceScore: number;
	preferenceScoreConfidence: number;
}

/**
 * Replays `acceptCount` and `rejectCount` reactions through the new weight system.
 */
export function replayMigratedPreferenceEstimate(
	acceptCount: number,
	rejectCount: number,
): MigratedPreferenceEstimate {
	const numReactions = acceptCount + rejectCount;
	const preferenceScoreConfidence =
		INITIAL_PREFERENCE_SCORE_CONFIDENCE + numReactions * MIGRATION_PREVIOUS_FEEDBACK_STRENGTH;
	const preferenceScore =
		numReactions === 0
			? 0
			: (MIGRATION_PREVIOUS_FEEDBACK_STRENGTH * (acceptCount - rejectCount)) / preferenceScoreConfidence;
	return { preferenceScore, preferenceScoreConfidence };
}
