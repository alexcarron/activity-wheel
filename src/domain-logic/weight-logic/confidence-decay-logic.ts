import { CONFIDENCE_DECAY_PER_DAY_RATE, INITIAL_PREFERENCE_SCORE_CONFIDENCE } from './weight-constants';

export const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Days elapsed since the last feedback. May not be a whole number.
 */
export function getDaysSinceLastFeedback(lastFeedbackAt: number, now: number): number {
	return Math.max(0, (now - lastFeedbackAt) / MILLISECONDS_PER_DAY);
}

/**
 * Gets the current confidence for an activity from its stored confidence and how long it's gone without feedback.
 */
export function getDecayedPreferenceScoreConfidence({
	preferenceScoreConfidence,
	lastFeedbackAt,
	now,
}: {
	preferenceScoreConfidence: number;
	lastFeedbackAt: number;
	now: number;
}): number {
	const daysSinceLastFeedback = getDaysSinceLastFeedback(lastFeedbackAt, now);
	const decayedConfidence = preferenceScoreConfidence - CONFIDENCE_DECAY_PER_DAY_RATE * daysSinceLastFeedback;
	return Math.max(INITIAL_PREFERENCE_SCORE_CONFIDENCE, decayedConfidence);
}
