import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { ChosenActivity, RatingFeedbackAction } from '../../../domain-logic/types';
import type { ChosenActivityClearedBy, ChosenActivityWithDetails } from '../../../hooks/useChosenActivities';
import { FEEDBACK_ACTION_TO_BUTTON_LABEL, FEEDBACK_ACTION_TO_PAST_TENSE_LABEL } from '../../../constants/feedback-buttons';
import { RatingIcon } from '../../reusable/RatingIcon';
import { RatingIconButtons } from '../../reusable/RatingIconButtons';
import { UndoIcon } from '../../svg-icons/UndoIcon';
import { XIcon } from '../../svg-icons/XIcon';
import './HowWasItList.css';

const CLEARED_CHOSEN_ACTIVITY_VISIBLE_MILLISECONDS = 7000;
const CLEARED_CHOSEN_ACTIVITY_FADE_OUT_MILLISECONDS = 450;

function ClearedChosenActivityItem({
	activityName,
	clearedBy,
	isFadingOut,
	onStartFadingOut,
	onFinishFadingOut,
	onUndo,
}: {
	activityName: string;
	clearedBy: ChosenActivityClearedBy;
	isFadingOut: boolean;
	onStartFadingOut(): void;
	onFinishFadingOut(): void;
	onUndo(): void;
}) {
	const [isMouseOverItem, setIsMouseOverItem] = useState(false);
	const [isFocusInsideItem, setIsFocusInsideItem] = useState(false);
	const remainingVisibleMillisecondsRef = useRef(CLEARED_CHOSEN_ACTIVITY_VISIBLE_MILLISECONDS);
	const isCountdownPaused = isMouseOverItem || isFocusInsideItem;

	useEffect(() => {
		if (isCountdownPaused || isFadingOut) return;
		const countdownStartedAt = Date.now();
		const timer = setTimeout(onStartFadingOut, remainingVisibleMillisecondsRef.current);
		return () => {
			clearTimeout(timer);
			remainingVisibleMillisecondsRef.current -= Date.now() - countdownStartedAt;
		};
	}, [isCountdownPaused, isFadingOut, onStartFadingOut]);

	useEffect(() => {
		if (!isFadingOut) return;
		const timer = setTimeout(onFinishFadingOut, CLEARED_CHOSEN_ACTIVITY_FADE_OUT_MILLISECONDS);
		return () => clearTimeout(timer);
	}, [isFadingOut, onFinishFadingOut]);

	const isDismissal = clearedBy === 'dismissal';
	const clearedLabel = isDismissal ? 'Removed' : FEEDBACK_ACTION_TO_PAST_TENSE_LABEL[clearedBy];
	const undoLabel = isDismissal ? 'Undo removing from this list' : `Undo ${FEEDBACK_ACTION_TO_BUTTON_LABEL[clearedBy]}`;

	return (
		<li
			className={`how-was-it-entry${isFadingOut ? ' is-fading-out' : ''}`}
			onPointerEnter={(event) => {
				if (event.pointerType === 'mouse') setIsMouseOverItem(true);
			}}
			onPointerLeave={(event) => {
				if (event.pointerType === 'mouse') setIsMouseOverItem(false);
			}}
			onFocus={() => setIsFocusInsideItem(true)}
			onBlur={() => setIsFocusInsideItem(false)}
		>
			<div className="how-was-it-item">
				<span className="how-was-it-name" title={activityName}>
					{activityName}
				</span>
				<div className="how-was-it-cleared-actions">
					<span
						className={`how-was-it-cleared-message is-cleared-by-${clearedBy}${isCountdownPaused ? ' is-countdown-paused' : ''}`}
						role="status"
					>
						{isDismissal ? <XIcon /> : <RatingIcon action={clearedBy} />}
						{clearedLabel}
					</span>
					<button type="button" className="icon-btn" onClick={onUndo} title={undoLabel} aria-label={undoLabel}>
						<UndoIcon />
					</button>
				</div>
			</div>
		</li>
	);
}

export function HowWasItList({
	chosenActivitiesNewestFirst,
	onRate,
	onDismiss,
	onUndoRating,
	onUndoDismissal,
	onStartFadingOutClearedChosenActivity,
	onForgetClearedChosenActivity,
}: {
	chosenActivitiesNewestFirst: readonly ChosenActivityWithDetails[];
	onRate(activityID: string, action: RatingFeedbackAction): void;
	onDismiss(activityID: string): void;
	onUndoRating(activityID: string): void;
	onUndoDismissal(chosenActivity: ChosenActivity): void;
	onStartFadingOutClearedChosenActivity(activityID: string): void;
	onForgetClearedChosenActivity(activityID: string): void;
}) {
	if (chosenActivitiesNewestFirst.length === 0) return null;

	const isPanelCollapsing = chosenActivitiesNewestFirst.every(({ clearedState }) => clearedState?.isFadingOut);
	const clearedChosenActivityDurationStyle = {
		'--how-was-it-countdown-duration': `${CLEARED_CHOSEN_ACTIVITY_VISIBLE_MILLISECONDS}ms`,
		'--how-was-it-fade-out-duration': `${CLEARED_CHOSEN_ACTIVITY_FADE_OUT_MILLISECONDS}ms`,
	} as CSSProperties;

	return (
		<div className={`how-was-it-collapser${isPanelCollapsing ? ' is-collapsing' : ''}`} style={clearedChosenActivityDurationStyle}>
			<section className="app-panel how-was-it" aria-label="How was it?">
				<h2>
					How was it?
				</h2>
				<ul className="how-was-it-items">
					{chosenActivitiesNewestFirst.map(({ activity, chosenActivity, clearedState }) => {
						if (clearedState) {
							const { clearedBy } = clearedState;
							return (
								<ClearedChosenActivityItem
									key={activity.id}
									activityName={activity.name}
									clearedBy={clearedBy}
									isFadingOut={clearedState.isFadingOut}
									onStartFadingOut={() => onStartFadingOutClearedChosenActivity(activity.id)}
									onFinishFadingOut={() => onForgetClearedChosenActivity(activity.id)}
									onUndo={() => {
										if (clearedBy === 'dismissal') {
											onUndoDismissal(chosenActivity);
										}
										else {
											onUndoRating(activity.id);
										}
									}}
								/>
							);
						}

						return (
							<li key={activity.id} className="how-was-it-entry">
								<div className="how-was-it-item">
									<span className="how-was-it-name" title={activity.name}>
										{activity.name}
									</span>
									<div className="how-was-it-actions">
										<RatingIconButtons onRate={(action) => onRate(activity.id, action)} />
										<button
											type="button"
											className="icon-btn how-was-it-dismiss"
											onClick={() => onDismiss(activity.id)}
											title="Remove from this list without rating"
											aria-label={`Remove "${activity.name}" from this list without rating`}
										>
											<XIcon />
										</button>
									</div>
								</div>
							</li>
						);
					})}
				</ul>
			</section>
		</div>
	);
}
