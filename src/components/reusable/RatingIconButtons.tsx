import type { ReactNode } from 'react';
import type { RatingFeedbackAction } from '../../domain-logic/types';
import {
	FEEDBACK_ACTION_TO_BUTTON_LABEL,
	FEEDBACK_ACTION_TO_BUTTON_TOOLTIP,
	RATING_FEEDBACK_ACTIONS_BEST_TO_WORST,
} from '../../constants/feedback-buttons';
import { HeartIcon } from '../svg-icons/HeartIcon';
import { BrokenHeartIcon } from '../svg-icons/BrokenHeartIcon';
import { ThumbsUpIcon } from '../svg-icons/ThumbsUpIcon';
import { NeutralFaceIcon } from '../svg-icons/NeutralFaceIcon';
import { ThumbsDownIcon } from '../svg-icons/ThumbsDownIcon';
import './RatingIconButtons.css';

const RATING_ACTION_TO_CLASS_NAME: Record<RatingFeedbackAction, string> = {
	love: 'icon-btn-love-it',
	like: 'icon-btn-like-it',
	neutral: 'icon-btn-neutral',
	dislike: 'icon-btn-dislike-it',
	hate: 'icon-btn-hate-it',
};

const RATING_ACTION_TO_ICON: Record<RatingFeedbackAction, ReactNode> = {
	love: <HeartIcon />,
	like: <ThumbsUpIcon />,
	neutral: <NeutralFaceIcon />,
	dislike: <ThumbsDownIcon />,
	hate: <BrokenHeartIcon />,
};

export function RatingIconButtons({
	lastRatingAction,
	onRate,
}: {
	lastRatingAction?: RatingFeedbackAction;
	onRate(action: RatingFeedbackAction): void;
}) {
	return (
		<>
			{RATING_FEEDBACK_ACTIONS_BEST_TO_WORST.map((action) => {
				const isLastRating = action === lastRatingAction;
				const lastRatingNote = isLastRating ? ' Your last rating.' : '';
				return (
					<button
						key={action}
						type="button"
						className={`icon-btn ${RATING_ACTION_TO_CLASS_NAME[action]}${isLastRating ? ' is-last-rating' : ''}`}
						onClick={() => onRate(action)}
						title={`${FEEDBACK_ACTION_TO_BUTTON_TOOLTIP[action]}${lastRatingNote}`}
						aria-label={`${FEEDBACK_ACTION_TO_BUTTON_LABEL[action]}${lastRatingNote}`}
					>
						{RATING_ACTION_TO_ICON[action]}
					</button>
				);
			})}
		</>
	);
}
