import type { RatingFeedbackAction } from '../../../domain-logic/types';
import { FEEDBACK_ACTION_TO_BUTTON_LABEL } from '../../../constants/feedback-buttons';
import { UndoIcon } from '../../svg-icons/UndoIcon';

export function UndoRatingButton({
	undoableRatingAction,
	onClick,
}: {
	undoableRatingAction: RatingFeedbackAction;
	onClick(): void;
}) {
	const undoLabel = `Undo ${FEEDBACK_ACTION_TO_BUTTON_LABEL[undoableRatingAction]}`;

	return (
		<button
			type="button"
			className="icon-btn icon-btn-undo-rating"
			onClick={onClick}
			title={undoLabel}
			aria-label={undoLabel}
		>
			<UndoIcon />
		</button>
	);
}
