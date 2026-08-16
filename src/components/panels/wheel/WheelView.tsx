/**
 * Hosts the wheel itself plus the spin button and the post-spin actions. Keeps the wiring between `useWheel`, `useSession`, and feedback in one place so `App.tsx` stays mostly composition. 
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Activity, FeedbackAction, TagMetadata } from '../../../domain-logic/types';
import { estimateStableProbabilities } from '../../../domain-logic/weight-logic/stable-probability-estimate-logic';
import { getProbabilitiesFromActualCurrentWeights } from '../../../domain-logic/weight-logic/preference-to-weight-logic';
import { defaultRng } from '../../../utils/random-utils';
import { useNow } from '../../../hooks/useNow';
import { useWheel } from '../../../hooks/wheel/useWheel';
import { useHotkey } from '../../../hooks/useHotkey';
import { HOTKEYS } from '../../../constants/hotkeys';
import type { SessionApi } from '../../../hooks/useSession';
import { Wheel } from './Wheel';
import { PostSpinActions } from './PostSpinActions';
import { KeyboardHint } from '../../reusable/KeyboardHint';
import { PinIcon } from '../../svg-icons/PinIcon';
import './WheelView.css';

interface Props {
	readonly activities: readonly Activity[];
	readonly session: SessionApi;
	readonly rngSeed: string;
	readonly spreadFactor: number;
	readonly tagFilterActive: boolean;
	readonly allTagMetadata: readonly TagMetadata[];
	readonly isWheelPinned: boolean;
	readonly activityIDToLockedActualWeight: Map<string, number>;
	readonly shouldSizeWheelByActualCurrentWeights: boolean;
	/** Called right after a spin is started, so a new random actual current weight gets picked for the next round. */
	onSpun(): void;
	onToggleWheelPinned(): void;
	onClearTagFilter(): void;
	onFeedback(id: string, action: FeedbackAction): Promise<void>;
	onRename(id: string, name: string): Promise<void>;
	onAddTagToActivity(activityID: string, tagName: string): Promise<void>;
	/** Called whenever the currently-landed-on activity id changes. Used to detect confusing remote changes to a shared wheel's in-progress spin. */
	onLandedActivityIDChange?(id: string | null): void;
}

export function WheelView({
	activities,
	session,
	rngSeed,
	spreadFactor,
	tagFilterActive,
	allTagMetadata,
	isWheelPinned: wheelPinned,
	activityIDToLockedActualWeight: lockedActualWeightByActivityID,
	shouldSizeWheelByActualCurrentWeights: sizeWheelByActualCurrentWeights,
	onSpun,
	onToggleWheelPinned,
	onClearTagFilter,
	onFeedback,
	onRename,
	onAddTagToActivity,
	onLandedActivityIDChange,
}: Props) {
	const wheel = useWheel();
	const [busy, setBusy] = useState(false);
	const now = useNow();

	const remainingActivities = session.remainingActivities;

	const estimatedStableProbabilities = useMemo(
		() => estimateStableProbabilities({ activities: remainingActivities, now, rng: defaultRng, spreadFactor }),
		[remainingActivities, now, spreadFactor],
	);

	const actualCurrentProbabilities = useMemo(() => {
		const actualCurrentWeights = remainingActivities.map(
			(activity) => lockedActualWeightByActivityID.get(activity.id) ?? 0,
		);
		return getProbabilitiesFromActualCurrentWeights({ actualCurrentWeights, spreadFactor });
	}, [remainingActivities, lockedActualWeightByActivityID, spreadFactor]);

	const { sortedActivities, sliceProbabilities } = useMemo(() => {
		const sortProbabilities = sizeWheelByActualCurrentWeights
			? actualCurrentProbabilities
			: estimatedStableProbabilities;
		const pairs = remainingActivities.map((activity, index) => ({
			activity,
			sliceProbability: sortProbabilities[index],
		}));
		pairs.sort((pair1, pair2) => pair2.sliceProbability - pair1.sliceProbability);
		return {
			sortedActivities: pairs.map((pair) => pair.activity),
			sliceProbabilities: pairs.map((pair) => pair.sliceProbability),
		};
	}, [remainingActivities, estimatedStableProbabilities, actualCurrentProbabilities, sizeWheelByActualCurrentWeights]);

	const pickedActivity = useMemo(() => {
		if (!wheel.result) return null;
		return (
			activities.find((activity) => activity.id === wheel.result!.pickedActivity.id) ??
			wheel.result.pickedActivity
		);
	}, [activities, wheel.result]);

	const spinActivities = useCallback(
		(candidateActivities: readonly Activity[], candidateSliceProbabilities: readonly number[]) => {
			if (candidateActivities.length === 0) return;
			const seed = rngSeed.trim() ? `${rngSeed}|${Date.now()}|${candidateActivities.length}` : undefined;
			const weights = candidateActivities.map((activity) => lockedActualWeightByActivityID.get(activity.id) ?? 0);
			const didSpin = wheel.spin({
				activities: candidateActivities,
				weights,
				displaySliceProbabilities: candidateSliceProbabilities,
				seed,
				spreadFactor,
			});
			if (didSpin) onSpun();
		},
		[lockedActualWeightByActivityID, rngSeed, spreadFactor, wheel, onSpun],
	);

	const handleSpin = useCallback(() => {
		spinActivities(sortedActivities, sliceProbabilities);
	}, [spinActivities, sortedActivities, sliceProbabilities]);

	const handleAnimationComplete = useCallback(() => {
		wheel.finish();
	}, [wheel]);

	const handleFeedback = useCallback(
		async (action: FeedbackAction): Promise<void> => {
			if (!pickedActivity) return;
			setBusy(true);
			try {
				await onFeedback(pickedActivity.id, action);
			}
			finally {
				session.excludeActivity(pickedActivity.id);
				setBusy(false);
				wheel.resetWheel();
			}
		},
		[onFeedback, wheel, session, pickedActivity],
	);

	const handleSpinAgain = useCallback(() => {
		if (pickedActivity)
			session.excludeActivity(pickedActivity.id);

		const nextCandidateIndices = sortedActivities
			.map((activity, index) => ({ activity, index }))
			.filter((pair) => pair.activity.id !== pickedActivity?.id);

		spinActivities(
			nextCandidateIndices.map((pair) => pair.activity),
			nextCandidateIndices.map((pair) => sliceProbabilities[pair.index]),
		);
	}, [spinActivities, sortedActivities, sliceProbabilities, pickedActivity, session]);

	const handleResetSession = useCallback(() => {
		session.resetExcludedActivities();
		wheel.resetWheelAndSession();
	}, [session, wheel]);

	useEffect(() => {
		if (wheel.result && !activities.find((activity) => activity.id === wheel.result?.pickedActivity.id)) {
			wheel.resetWheel();
		}
	}, [activities, wheel]);

	const isIdle = wheel.phase === 'idle';
	const isAnimating = wheel.phase === 'spinning';
	const isLanded = wheel.phase === 'landed';

	useEffect(() => {
		onLandedActivityIDChange?.(isLanded && pickedActivity ? pickedActivity.id : null);
	}, [isLanded, pickedActivity, onLandedActivityIDChange]);

	useHotkey(HOTKEYS.SPIN_WHEEL.code, handleSpin, isIdle && remainingActivities.length > 0);

	const currentRotation = wheel.rotationDeg;
	const targetRotation = wheel.result?.targetRotationDegrees ?? wheel.rotationDeg;

	const displayedActivities = wheel.result?.orderedDisplayedActivities ?? sortedActivities;
	const displayedSliceProbabilities = wheel.result?.displaySliceProbabilities ?? sliceProbabilities;

	const headline = useMemo(() => {
		if (activities.length === 0 && !tagFilterActive) return 'Add an activity to start the wheel.';
		if (activities.length === 0 && tagFilterActive) return null;
		if (remainingActivities.length === 0 && !tagFilterActive)
			return 'No activities left this session. Reset to spin again.';
		if (remainingActivities.length === 0 && tagFilterActive) return null;
		return null;
	}, [activities.length, remainingActivities.length, tagFilterActive]);

	return (
		<section className="wheel-view">
			<button
				type="button"
				className={`wheel-pin-btn${wheelPinned ? ' is-active' : ''}`}
				onClick={onToggleWheelPinned}
				title={wheelPinned ? 'Unpin wheel' : 'Pin wheel so it stays visible while you scroll'}
				aria-label={wheelPinned ? 'Unpin wheel' : 'Pin wheel'}
				aria-pressed={wheelPinned}
			>
				<PinIcon isFilled={wheelPinned} />
			</button>

			<Wheel
				activities={displayedActivities}
				sliceProbabilities={displayedSliceProbabilities}
				currentRotationDeg={currentRotation}
				targetRotationDeg={targetRotation}
				animating={isAnimating}
				onComplete={handleAnimationComplete}
			/>

			{isIdle && (
				<div className="wheel-actions">
					{tagFilterActive && activities.length === 0 && (
						<div className="wheel-tag-empty">
							<p className="wheel-empty">No activities match this filter.</p>
							<button type="button" className="btn btn-secondary" onClick={onClearTagFilter}>
								Clear filter
							</button>
						</div>
					)}
					{tagFilterActive && activities.length > 0 && remainingActivities.length === 0 && (
						<div className="wheel-tag-empty">
							<p className="wheel-empty">All filtered activities have been spun this session.</p>
							<div style={{ display: 'flex', gap: 8 }}>
								<button type="button" className="btn btn-secondary" onClick={handleResetSession}>
									Reset session
								</button>
								<button type="button" className="btn btn-ghost" onClick={onClearTagFilter}>
									Clear filter
								</button>
							</div>
						</div>
					)}
					{headline && <p className="wheel-empty">{headline}</p>}
					{remainingActivities.length > 0 && (
						<button
							type="button"
							className="btn btn-primary btn-large"
							onClick={handleSpin}
							title={`Spin the wheel (${HOTKEYS.SPIN_WHEEL.label})`}
						>
							Spin the wheel
							<KeyboardHint label={HOTKEYS.SPIN_WHEEL.label} />
						</button>
					)}
					{remainingActivities.length === 0 && activities.length > 0 && !tagFilterActive && (
						<button type="button" className="btn btn-secondary" onClick={handleResetSession}>
							Reset session
						</button>
					)}
				</div>
			)}

			{isAnimating && (
				<div className="wheel-actions">
					<p className="wheel-spinning">Spinning…</p>
				</div>
			)}

			{isLanded && pickedActivity && (
				<PostSpinActions
					pickedActivity={pickedActivity}
					remainingActivityCount={
						session.remainingActivities.filter((activity) => activity.id !== pickedActivity.id).length
					}
					onChoose={(action) => void handleFeedback(action)}
					onSpinAgain={handleSpinAgain}
					onResetSession={handleResetSession}
					busy={busy}
					onRename={onRename}
					allTagMetadata={allTagMetadata}
					onAddTag={onAddTagToActivity}
				/>
			)}
		</section>
	);
}
