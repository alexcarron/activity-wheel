/**
 * Hosts the wheel itself plus the spin button and the post-spin actions.
 * Keeps the wiring between `useWheel`, `useSession`, and feedback in one place
 * so `App.tsx` stays mostly composition.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Activity, FeedbackAction, TagMetadata } from '../domain-logic/types';
import { getEffectiveWeight } from '../domain-logic/weight-logic';
import { useWeightContext } from '../context/WeightContext';
import { useNow } from '../hooks/useNow';
import { useWheel } from '../hooks/wheel/useWheel';
import { useHotkey } from '../hooks/useHotkey';
import { HOTKEYS } from '../hotkeys';
import type { SessionApi } from '../hooks/useSession';
import { Wheel } from './Wheel';
import { PostSpinActions } from './PostSpinActions';
import { KbdHint } from './KbdHint';

interface Props {
  readonly activities: readonly Activity[];
  readonly session: SessionApi;
  /** Optional seed string. Empty/undefined = real randomness. */
  readonly rngSeed: string;
  /** True when a tag filter is currently restricting the pool. */
  readonly tagFilterActive: boolean;
  /** All known tag metadata — passed through to PostSpinActions for the tag nudge. */
  readonly allTagMetadata: readonly TagMetadata[];
  /** Called by the empty-state "clear filter" button. */
  onClearTagFilter(): void;
  onFeedback(id: string, action: FeedbackAction): Promise<void>;
  onRename(id: string, name: string): Promise<void>;
  /** Called when user adds a tag from the post-spin "Add a tag?" prompt. */
  onAddTagToActivity(activityId: string, tagName: string): Promise<void>;
}

export function WheelView({ activities, session, rngSeed, tagFilterActive, allTagMetadata, onClearTagFilter, onFeedback, onRename, onAddTagToActivity }: Props) {
  const wheel = useWheel();
  const [busy, setBusy] = useState(false);
  const globalWeightContext = useWeightContext();
  const now = useNow();

  // The wheel renders the *session* pool, not the full activity list. That's
  // why the slices visibly shrink as you spin through a session.
  const pool = session.pool;

  // Effective weights for each pool item — used to size wheel slices.
  const poolWeights = useMemo(() => {
    return pool.map((a) => getEffectiveWeight(a, now, globalWeightContext));
  }, [pool, now, globalWeightContext]);

  // Resolve the winner against the live activities array so that renames made
  // from the post-spin panel are reflected immediately without needing the
  // wheel to re-spin. Falls back to the snapshot if the activity was deleted.
  const liveWinner = useMemo(() => {
    if (!wheel.result) return null;
    return (
      activities.find((a) => a.id === wheel.result!.activity.id) ??
      wheel.result.activity
    );
  }, [activities, wheel.result]);

  const handleSpin = useCallback(() => {
    if (pool.length === 0) return;
    const seed = rngSeed.trim() ? `${rngSeed}|${Date.now()}|${pool.length}` : undefined;
    wheel.spin(pool, seed);
  }, [pool, rngSeed, wheel]);

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
      } finally {
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
    if (wheel.result && !activities.find((a) => a.id === wheel.result?.activity.id)) {
      wheel.resetWheel();
    }
  }, [activities, wheel]);

  const idle = wheel.phase === 'idle';
  const animating = wheel.phase === 'spinning';
  const landed = wheel.phase === 'landed';

  // Space spins the wheel when idle. PostSpinActions mounts its own Space
  // binding for "spin again" while landed — the two are mutually exclusive
  // because each is only enabled in its respective phase.
  useHotkey(HOTKEYS.SPIN.code, handleSpin, idle && pool.length > 0);

  // `currentRotation` is where the wheel sits *right now* — the previous
  // landing point. While spinning, the Wheel component animates from this
  // value to `targetRotation`. When idle, both are equal (no animation).
  const currentRotation = wheel.rotationDeg;
  const targetRotation = wheel.result?.targetRotationDeg ?? wheel.rotationDeg;

  const headline = useMemo(() => {
    if (activities.length === 0 && !tagFilterActive) return 'Add an activity to start the wheel.';
    if (activities.length === 0 && tagFilterActive) return null; // handled by tag empty state below
    if (pool.length === 0 && !tagFilterActive) return 'Session pool is empty — reset to spin again.';
    if (pool.length === 0 && tagFilterActive) return null; // handled by tag empty state below
    return null;
  }, [activities.length, pool.length, tagFilterActive]);

  return (
    <section className="wheel-view">
      <Wheel
        pool={pool}
        weights={poolWeights}
        currentRotationDeg={currentRotation}
        targetRotationDeg={targetRotation}
        animating={animating}
        onComplete={handleAnimationComplete}
      />

      {idle && (
        <div className="wheel-actions">
          {/* Tag filter empty state — no activities match the current filter */}
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
          {/* Spin button — only when pool has items */}
          {pool.length > 0 && (
            <button
              type="button"
              className="btn btn-primary btn-large"
              onClick={handleSpin}
              title={`Spin the wheel (${HOTKEYS.SPIN.label})`}
            >
              Spin the wheel
              <KbdHint label={HOTKEYS.SPIN.label} />
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
