/**
 * Hosts the wheel itself plus the spin button and the post-spin actions. Keeps the wiring between `useWheel`, `useSession`, and feedback in one place so `App.tsx` stays mostly composition. 
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Activity, FeedbackAction, TagMetadata } from '../domain-logic/types';
import { applySpreadToWeights } from '../domain-logic/weight-logic/weight-spread-logic';
import { getEffectiveWeight } from '../domain-logic/weight-logic/effective-weight-logic';
import { useWeightContext } from '../context/WeightContext';
import { useNow } from '../hooks/useNow';
import { useWheel } from '../hooks/wheel/useWheel';
import { useHotkey } from '../hooks/useHotkey';
import { HOTKEYS } from '../constants/hotkeys';
import type { SessionApi } from '../hooks/useSession';
import { Wheel } from './Wheel';
import { PostSpinActions } from './PostSpinActions';
import { KbdHint } from './KbdHint';

interface Props {
	readonly activities: readonly Activity[];
	readonly session: SessionApi;
	/** Optional seed string. Empty/undefined = real randomness. */
	readonly rngSeed: string;
	/** Debug-only: how much to exaggerate (>1) or compress (<1) differences between weights. 1 = unchanged. */
	readonly spreadFactor: number;
	/** True when a tag filter is currently restricting the pool. */
	readonly tagFilterActive: boolean;
	/** All known tag metadata. Passed through to PostSpinActions for the tag nudge. */
	readonly allTagMetadata: readonly TagMetadata[];
	/** Whether the wheel header is currently pinned while scrolling. */
	readonly wheelPinned: boolean;
	onToggleWheelPinned(): void;
	/** Called by the empty-state "clear filter" button. */
	onClearTagFilter(): void;
	onFeedback(id: string, action: FeedbackAction): Promise<void>;
	onRename(id: string, name: string): Promise<void>;
	/** Called when user adds a tag from the post-spin "Add a tag?" prompt. */
	onAddTagToActivity(activityId: string, tagName: string): Promise<void>;
	/** Called whenever the currently-landed-on activity id changes (null when not landed). Used to detect confusing remote changes to a shared wheel's in-progress spin. */
	onLandedActivityIdChange?(id: string | null): void;
}

export function WheelView({
	activities,
	session,
	rngSeed,
	spreadFactor,
	tagFilterActive,
	allTagMetadata,
	wheelPinned,
	onToggleWheelPinned,
	onClearTagFilter,
	onFeedback,
	onRename,
	onAddTagToActivity,
	onLandedActivityIdChange,
}: Props) {
	const wheel = useWheel();
	const [busy, setBusy] = useState(false);
	const globalWeightContext = useWeightContext();
	const now = useNow();

	// The wheel renders the *session* pool, not the full activity list. That's
	// why the slices visibly shrink as you spin through a session.
	const pool = session.pool;

	// Effective weights for each pool item. Used to size wheel slices.
	// The debug "spread" slider then exaggerates or compresses the differences
	// between them, without touching the stored weights.
	const poolWeights = useMemo(() => {
		const effectiveWeights = pool.map((activity) =>
			getEffectiveWeight(activity, now, globalWeightContext),
		);
		return applySpreadToWeights(effectiveWeights, spreadFactor);
	}, [pool, now, globalWeightContext, spreadFactor]);

	// Sort pool by effective weight descending so the heaviest slice sits at
	// 12 o'clock. The sorted order is passed to both Wheel (draw) and spin()
	// so the rotation math stays consistent.
	const { sortedPool, sortedWeights } = useMemo(() => {
		const pairs = pool.map((activity, index) => ({ activity, weight: poolWeights[index] }));
		pairs.sort((pair1, pair2) => pair2.weight - pair1.weight);
		return {
			sortedPool: pairs.map((pair) => pair.activity),
			sortedWeights: pairs.map((pair) => pair.weight),
		};
	}, [pool, poolWeights]);

	// Resolve the winner against the live activities array so that renames made
	// from the post-spin panel are reflected immediately without needing the
	// wheel to re-spin. Falls back to the snapshot if the activity was deleted.
	const liveWinner = useMemo(() => {
		if (!wheel.result) return null;
		return (
			activities.find((activity) => activity.id === wheel.result!.activity.id) ??
			wheel.result.activity
		);
	}, [activities, wheel.result]);

	const handleSpin = useCallback(() => {
		if (sortedPool.length === 0) return;
		const seed = rngSeed.trim() ? `${rngSeed}|${Date.now()}|${sortedPool.length}` : undefined;
		wheel.spin(sortedPool, seed, spreadFactor);
	}, [sortedPool, rngSeed, spreadFactor, wheel]);

	const handleAnimationComplete = useCallback(() => {
		wheel.finish();
		if (wheel.result) session.exclude(wheel.result.activity.id);
	}, [session, wheel]);

	const handleFeedback = useCallback(
		async (action: FeedbackAction): Promise<void> => {
			const winner = wheel.result?.activity;
			if (!winner) return;
			setBusy(true);
			try {
				await onFeedback(winner.id, action);
			}
			finally {
				setBusy(false);
				wheel.resetWheel();
			}
		},
		[onFeedback, wheel],
	);

	const handleSpinAgain = useCallback(() => {
		// useWheel.spin only blocks when phase === 'spinning'; from 'landed' it
		// simply replaces the result, so we don't need a reset round-trip.
		if (session.pool.length > 0) handleSpin();
	}, [handleSpin, session.pool.length]);

	const handleResetSession = useCallback(() => {
		session.reset();
		wheel.resetWheelAndSession();
	}, [session, wheel]);

	// If the active list shrinks (deletion) and the winner was deleted while
	// we're animating, reset gracefully.
	useEffect(() => {
		if (wheel.result && !activities.find((activity) => activity.id === wheel.result?.activity.id)) {
			wheel.resetWheel();
		}
	}, [activities, wheel]);

	const idle = wheel.phase === 'idle';
	const animating = wheel.phase === 'spinning';
	const landed = wheel.phase === 'landed';

	useEffect(() => {
		onLandedActivityIdChange?.(landed && liveWinner ? liveWinner.id : null);
	}, [landed, liveWinner, onLandedActivityIdChange]);

	// Space spins the wheel when idle. PostSpinActions mounts its own Space
	// binding for "spin again" while landed. The two are mutually exclusive
	// because each is only enabled in its respective phase.
	useHotkey(HOTKEYS.SPIN_WHEEL.code, handleSpin, idle && pool.length > 0);

	// `currentRotation` is where the wheel sits *right now*. The previous
	// landing point. While spinning, the Wheel component animates from this
	// value to `targetRotation`. When idle, both are equal (no animation).
	const currentRotation = wheel.rotationDeg;
	const targetRotation = wheel.result?.targetRotationDeg ?? wheel.rotationDeg;

	const headline = useMemo(() => {
		if (activities.length === 0 && !tagFilterActive) return 'Add an activity to start the wheel.';
		if (activities.length === 0 && tagFilterActive) return null; // handled by tag empty state below
		if (pool.length === 0 && !tagFilterActive)
			return 'Session pool is empty. Reset to spin again.';
		if (pool.length === 0 && tagFilterActive) return null; // handled by tag empty state below
		return null;
	}, [activities.length, pool.length, tagFilterActive]);

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
				📌
			</button>

			<Wheel
				pool={sortedPool}
				weights={sortedWeights}
				currentRotationDeg={currentRotation}
				targetRotationDeg={targetRotation}
				animating={animating}
				onComplete={handleAnimationComplete}
			/>

			{idle && (
				<div className="wheel-actions">
					{/* Tag filter empty state. No activities match the current filter */}
					{tagFilterActive && activities.length === 0 && (
						<div className="wheel-tag-empty">
							<p className="wheel-empty">No activities match this filter.</p>
							<button type="button" className="btn btn-secondary" onClick={onClearTagFilter}>
								Clear filter
							</button>
						</div>
					)}
					{/* Session pool exhausted under an active tag filter */}
					{tagFilterActive && activities.length > 0 && pool.length === 0 && (
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
					{/* Normal headline (no activities at all, session empty without filter) */}
					{headline && <p className="wheel-empty">{headline}</p>}
					{/* Spin button. Only when pool has items */}
					{pool.length > 0 && (
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
					{/* Session reset for no-filter empty pool */}
					{pool.length === 0 && activities.length > 0 && !tagFilterActive && (
						<button type="button" className="btn btn-secondary" onClick={handleResetSession}>
							Reset session
						</button>
					)}
				</div>
			)}

			{animating && (
				<div className="wheel-actions">
					<p className="wheel-spinning">Spinning…</p>
				</div>
			)}

			{landed && liveWinner && (
				<PostSpinActions
					winner={liveWinner}
					remainingInPool={session.pool.length}
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
