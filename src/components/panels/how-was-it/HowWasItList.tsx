import type { RatingFeedbackAction } from '../../../domain-logic/types';
import type { ChosenActivityWithDetails } from '../../../hooks/useChosenActivities';
import { RatingIconButtons } from '../../reusable/RatingIconButtons';
import './HowWasItList.css';

export function HowWasItList({
	chosenActivitiesNewestFirst,
	onRate,
	onDismiss,
}: {
	chosenActivitiesNewestFirst: readonly ChosenActivityWithDetails[];
	onRate(activityID: string, action: RatingFeedbackAction): void;
	onDismiss(activityID: string): void;
}) {
	if (chosenActivitiesNewestFirst.length === 0) return null;

	return (
		<section className="app-panel how-was-it" aria-label="How was it?">
			<h2>
				How was it?
				<span className="app-panel-filter-badge">{chosenActivitiesNewestFirst.length}</span>
			</h2>
			<ul className="how-was-it-items">
				{chosenActivitiesNewestFirst.map(({ activity }) => (
					<li key={activity.id} className="how-was-it-item">
						<span className="how-was-it-name" title={activity.name}>
							{activity.name}
						</span>
						<div className="how-was-it-actions">
							<RatingIconButtons
								lastRatingAction={activity.lastFeedbackAction}
								onRate={(action) => onRate(activity.id, action)}
							/>
							<button
								type="button"
								className="icon-btn how-was-it-dismiss"
								onClick={() => onDismiss(activity.id)}
								title="Remove from this list without rating"
								aria-label={`Remove "${activity.name}" from this list without rating`}
							>
								✕
							</button>
						</div>
					</li>
				))}
			</ul>
		</section>
	);
}
