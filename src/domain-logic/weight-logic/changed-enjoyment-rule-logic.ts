import {
	CHANGED_ENJOYMENT_CONFIDENCE_MULTIPLIER,
	INITIAL_PREFERENCE_SCORE_CONFIDENCE,
	MINIMUM_POINTS_FROM_SCORE_FOR_UNEXPECTED_RATING,
	UNEXPECTED_RATINGS_IN_A_ROW_TO_LOWER_CONFIDENCE,
} from './weight-constants';

export function getUnexpectedRatingStreakAfterRating({
	unexpectedRatingStreak,
	preferenceScore,
	preferencePointsAwarded,
}: {
	unexpectedRatingStreak: number;
	preferenceScore: number;
	preferencePointsAwarded: number;
}): number {
	const pointsFromScore = preferencePointsAwarded - preferenceScore;
	const isUnexpectedRating = Math.abs(pointsFromScore) >= MINIMUM_POINTS_FROM_SCORE_FOR_UNEXPECTED_RATING;
	if (!isUnexpectedRating) return 0;

	const direction = Math.sign(pointsFromScore);
	const previousStreak = Number.isFinite(unexpectedRatingStreak) ? unexpectedRatingStreak : 0;
	const isContinuingStreak = Math.sign(previousStreak) === direction;
	return isContinuingStreak ? previousStreak + direction : direction;
}

export function getConfidenceAfterChangedEnjoymentRule({
	preferenceScoreConfidence,
	unexpectedRatingStreak,
}: {
	preferenceScoreConfidence: number;
	unexpectedRatingStreak: number;
}): number {
	const isEnjoymentLikelyChanged = Math.abs(unexpectedRatingStreak) >= UNEXPECTED_RATINGS_IN_A_ROW_TO_LOWER_CONFIDENCE;
	if (!isEnjoymentLikelyChanged) return preferenceScoreConfidence;
	return Math.max(
		INITIAL_PREFERENCE_SCORE_CONFIDENCE,
		preferenceScoreConfidence * CHANGED_ENJOYMENT_CONFIDENCE_MULTIPLIER,
	);
}
