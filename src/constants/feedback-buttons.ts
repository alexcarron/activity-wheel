import type { FeedbackAction } from '../domain-logic/types';

type RatingFeedbackAction = Exclude<FeedbackAction, 'undo'>;

export const FEEDBACK_ACTION_TO_BUTTON_LABEL: Record<RatingFeedbackAction, string> = {
	love: 'Love It!',
	like: 'Like It',
	neutral: 'Meh',
	dislike: 'Dislike It',
	hate: 'Hate It!',
};

export const FEEDBACK_ACTION_TO_BUTTON_TOOLTIP: Record<RatingFeedbackAction, string> = {
	love: `${FEEDBACK_ACTION_TO_BUTTON_LABEL.love} (rate this something you really love doing)`,
	like: `${FEEDBACK_ACTION_TO_BUTTON_LABEL.like} (rate this something you enjoy)`,
	neutral: `${FEEDBACK_ACTION_TO_BUTTON_LABEL.neutral} (rate this don't like but don't dislike)`,
	dislike: `${FEEDBACK_ACTION_TO_BUTTON_LABEL.dislike} (rate this something you would rather not do)`,
	hate: `${FEEDBACK_ACTION_TO_BUTTON_LABEL.hate} (rate this something you never want to do)`,
};
