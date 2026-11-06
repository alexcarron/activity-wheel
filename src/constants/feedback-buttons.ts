import type { RatingFeedbackAction } from '../domain-logic/types';

export const RATING_FEEDBACK_ACTIONS_BEST_TO_WORST: readonly RatingFeedbackAction[] = ['love', 'like', 'neutral', 'dislike', 'hate'];

export const FEEDBACK_ACTION_TO_BUTTON_LABEL: Record<RatingFeedbackAction, string> = {
	love: 'Love It!',
	like: 'Like It',
	neutral: 'Meh',
	dislike: 'Dislike It',
	hate: 'Hate It!',
};

export const FEEDBACK_ACTION_TO_PAST_TENSE_LABEL: Record<RatingFeedbackAction, string> = {
	love: 'Loved It!',
	like: 'Liked It',
	neutral: 'Felt Meh',
	dislike: 'Disliked It',
	hate: 'Hated It!',
};

export const FEEDBACK_ACTION_TO_BUTTON_TOOLTIP: Record<RatingFeedbackAction, string> = {
	love: `${FEEDBACK_ACTION_TO_BUTTON_LABEL.love} (you loved doing this)`,
	like: `${FEEDBACK_ACTION_TO_BUTTON_LABEL.like} (you enjoyed doing this)`,
	neutral: `${FEEDBACK_ACTION_TO_BUTTON_LABEL.neutral} (you neither enjoyed nor disliked doing this)`,
	dislike: `${FEEDBACK_ACTION_TO_BUTTON_LABEL.dislike} (you didn't enjoy doing this)`,
	hate: `${FEEDBACK_ACTION_TO_BUTTON_LABEL.hate} (you hated doing this)`,
};
