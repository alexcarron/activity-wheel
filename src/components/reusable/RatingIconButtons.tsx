import type { RatingFeedbackAction } from '../../domain-logic/types';
import {
	FEEDBACK_ACTION_TO_BUTTON_LABEL,
	FEEDBACK_ACTION_TO_BUTTON_TOOLTIP,
	RATING_FEEDBACK_ACTIONS_BEST_TO_WORST,
} from '../../constants/feedback-buttons';
import { RatingIcon } from './RatingIcon';
import './RatingIconButtons.css';

const RATING_ACTION_TO_CLASS_NAME: Record<RatingFeedbackAction, string> = {
	love: 'icon-btn-love-it',
	like: 'icon-btn-like-it',
	neutral: 'icon-btn-neutral',
	dislike: 'icon-btn-dislike-it',
	hate: 'icon-btn-hate-it',
};

export function RatingIconButtons({
	undoableRatingAction,
	onRate,
}: {
	undoableRatingAction?: RatingFeedbackAction;
	onRate(action: RatingFeedbackAction): void;
}) {
	return (
		<>
			{RATING_FEEDBACK_ACTIONS_BEST_TO_WORST.map((action) => {
				const isUndoableRating = action === undoableRatingAction;
				const undoableRatingNote = isUndoableRating ? ' Latest rating.' : '';
				return (
					<button
						key={action}
						type="button"
						className={`icon-btn ${RATING_ACTION_TO_CLASS_NAME[action]}${isUndoableRating ? ' is-undoable-rating' : ''}`}
						onClick={() => onRate(action)}
						title={`${FEEDBACK_ACTION_TO_BUTTON_TOOLTIP[action]}${undoableRatingNote}`}
						aria-label={`${FEEDBACK_ACTION_TO_BUTTON_LABEL[action]}${undoableRatingNote}`}
					>
						<RatingIcon action={action} />
					</button>
				);
			})}
		</>
	);
}
