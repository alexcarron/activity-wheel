import { clamp } from '../../utils/math-utils';
import { CONFIDENCE_DECAY_PER_DAY_RATE, INITIAL_PREFERENCE_SCORE_CONFIDENCE, MAXIMUM_PREFERENCE_SCORE_CONFIDENCE } from './weight-constants';

export const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Days elapsed since the last feedback. May not be a whole number.
 */
export function getDaysSinceLastFeedback(lastFeedbackAt: number, now: number): number {
	if (!Number.isFinite(lastFeedbackAt) || !Number.isFinite(now)) return 0;
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
	const sanitizedPreferenceScoreConfidence = Number.isFinite(preferenceScoreConfidence)
		? preferenceScoreConfidence
		: INITIAL_PREFERENCE_SCORE_CONFIDENCE;
	const daysSinceLastFeedback = getDaysSinceLastFeedback(lastFeedbackAt, now);
	const decayedConfidence = sanitizedPreferenceScoreConfidence - CONFIDENCE_DECAY_PER_DAY_RATE * daysSinceLastFeedback;
	return clamp(decayedConfidence, INITIAL_PREFERENCE_SCORE_CONFIDENCE, MAXIMUM_PREFERENCE_SCORE_CONFIDENCE);
}
