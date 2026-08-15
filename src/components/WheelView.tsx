/**
 * Hosts the wheel itself plus the spin button and the post-spin actions. Keeps the wiring between `useWheel`, `useSession`, and feedback in one place so `App.tsx` stays mostly composition. 
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Activity, FeedbackAction, TagMetadata } from '../domain-logic/types';
import { estimateStableProbabilities } from '../domain-logic/weight-logic/stable-probability-estimate-logic';
import { getProbabilitiesFromActualCurrentWeights } from '../domain-logic/weight-logic/preference-to-weight-logic';
import { defaultRng } from '../utils/random-utils';
import { useNow } from '../hooks/useNow';
import { useWheel } from '../hooks/wheel/useWheel';
import { useHotkey } from '../hooks/useHotkey';
import { HOTKEYS } from '../constants/hotkeys';
import type { SessionApi } from '../hooks/useSession';
import { Wheel } from './Wheel';
import { PostSpinActions } from './PostSpinActions';
import { KbdHint } from './KbdHint';
import './WheelView.css';

/** Pin glyph used on the wheel-pin toggle button. */
function PinIcon() {
	return (
		<svg
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
			className="wheel-pin-icon"
		>
			<path d="M12 17v5" />
			<path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
		</svg>
	);
}

interface Props {
	readonly activities: readonly Activity[];
	readonly session: SessionApi;
	/** Optional seed string. Empty/undefined = real randomness. */
	readonly rngSeed: string;
	/** Debug-only: how much to exaggerate (>1) or compress (<1) differences between weights. 1 = unchanged. */
	readonly spreadFactor: number;
	/** True when a tag filter is currently restricting the activities. */
	readonly tagFilterActive: boolean;
	/** All known tag metadata. Passed through to PostSpinActions for the tag nudge. */
	readonly allTagMetadata: readonly TagMetadata[];
	/** Whether the wheel header is currently pinned while scrolling. */
	readonly wheelPinned: boolean;
	/** The locked-in actual current weight for each activity, used to pick the spin winner so it matches whatever the debug pills are showing. */
	readonly lockedActualWeightByActivityID: Map<string, number>;
	/** Debug-only: when true, the wheel's slices are sized by each activity's locked actual current weight instead of its estimated stable weight. */
	readonly sizeWheelByActualCurrentWeights: boolean;
	/** Called right after a spin is started, so a new random actual current weight gets picked for the next round. */
	onSpun(): void;
	onToggleWheelPinned(): void;
	/** Called by the empty-state "clear filter" button. */
	onClearTagFilter(): void;
	onFeedback(id: string, action: FeedbackAction): Promise<void>;
	onRename(id: string, name: string): Promise<void>;
	/** Called when user adds a tag from the post-spin "Add a tag?" prompt. */
	onAddTagToActivity(activityID: string, tagName: string): Promise<void>;
	/** Called whenever the currently-landed-on activity id changes (null when not landed). Used to detect confusing remote changes to a shared wheel's in-progress spin. */
	onLandedActivityIDChange?(id: string | null): void;
}

export function WheelView({
	activities,
	session,
	rngSeed,
	spreadFactor,
	tagFilterActive,
	allTagMetadata,
	wheelPinned,
	lockedActualWeightByActivityID,
	sizeWheelByActualCurrentWeights,
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
			activities.find((activity) => activity.id === wheel.result!.activity.id) ??
			wheel.result.activity
		);
	}, [activities, wheel.result]);

	const handleSpin = useCallback(() => {
		if (sortedActivities.length === 0) return;
		const seed = rngSeed.trim() ? `${rngSeed}|${Date.now()}|${sortedActivities.length}` : undefined;
		const weights = sortedActivities.map((activity) => lockedActualWeightByActivityID.get(activity.id) ?? 0);
		const didSpin = wheel.spin({ activities: sortedActivities, weights, seed, spreadFactor });
		if (didSpin) onSpun();
	}, [sortedActivities, lockedActualWeightByActivityID, rngSeed, spreadFactor, wheel, onSpun]);

	const handleAnimationComplete = useCallback(() => {
		wheel.finish();
		if (wheel.result) session.exclude(wheel.result.activity.id);
	}, [session, wheel]);

	const handleFeedback = useCallback(
		async (action: FeedbackAction): Promise<void> => {
			if (!pickedActivity) return;
			setBusy(true);
			try {
				await onFeedback(pickedActivity.id, action);
			}
			finally {
				setBusy(false);
				wheel.resetWheel();
			}
		},
		[onFeedback, wheel, pickedActivity],
	);

	const handleSpinAgain = useCallback(() => {
		if (session.remainingActivities.length > 0) handleSpin();
	}, [handleSpin, session.remainingActivities.length]);

	const handleResetSession = useCallback(() => {
		session.reset();
		wheel.resetWheelAndSession();
	}, [session, wheel]);

	useEffect(() => {
		if (wheel.result && !activities.find((activity) => activity.id === wheel.result?.activity.id)) {
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
	const targetRotation = wheel.result?.targetRotationDeg ?? wheel.rotationDeg;

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
				<PinIcon />
			</button>

			<Wheel
				activities={sortedActivities}
				sliceProbabilities={sliceProbabilities}
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
							<KbdHint label={HOTKEYS.SPIN_WHEEL.label} />
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
					remainingActivityCount={session.remainingActivities.length}
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
