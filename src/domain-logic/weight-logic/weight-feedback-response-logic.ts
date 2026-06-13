/**
 * applyFeedback — the heart of the weight system.
 *
 * Applies a single user action to an activity and returns a new (immutable)
 * Activity reflecting the updated weight and metadata. Never mutates input.
 *
 * ─── Actions ────────────────────────────────────────────────────────────────
 *
 *  skip    No weight change whatsoever. Activity is returned unchanged.
 *          Streak is also left untouched so momentum isn't broken.
 *
 *  accept  Moderate positive step, scaled by:
 *            · momentum    (increases with consecutive accepts)
 *            · diminishing returns
 *            · dominance guard (suppresses growth if activity already
 *              dominates the pool — only on accept, not boost)
 *          Stores the applied delta in lastAcceptDelta to enable undo.
 *
 *  reject  Negative step, scaled by momentum and diminishing returns.
 *          Dominance guard never fires on the negative path — we always
 *          fully honour "I don't like this right now".
 *
 *  boost   Large intentional positive step (BOOST_STEP ≈ 3.5× accept).
 *          Applies momentum and diminishing returns but bypasses the
 *          dominance guard — the user explicitly asked for a big jump.
 *          Stores delta in lastAcceptDelta (undo can reverse it).
 *
 *  undo    Reverses the last stored positive delta (lastAcceptDelta).
 *          If no delta is stored, it's a no-op. Clears streak to 0
 *          since the user is stepping backwards.
 *
 * ─── Invariants ─────────────────────────────────────────────────────────────
 *  - All arithmetic is rounded to 4 decimal places to avoid float drift.
 *  - No IO, no side effects — pure function suitable for React state updates.
 */

import type { Activity, FeedbackAction } from '../types';
import {
	ACCEPT_STEP,
	BOOST_STEP,
	DOMINANCE_GUARD,
	HATE_STEP,
	REJECT_STEP,
} from './weight-constants';
import { getDiminishingFactor } from './weight-diminishing-returns-logic';
import { getEffectiveWeight } from './effective-weight-logic';
import { getMomentumInfoFor } from './weight-momentum-logic';
import type { GlobalWeightContext } from './weight-types';
import { getMinimumWeight } from './weight-minimum-logic';
import { getMaximumWeight } from './weight-maximum-logic';

/* ─── Helpers ────────────────────────────────────────────────────────────── */

const clamp = (number: number, minimum: number, maximum: number): number =>
  number < minimum ? minimum : number > maximum ? maximum : number;

/** Round to 4 decimal places to keep stored values clean. */
const roundTo4DecimalPlaces = (n: number): number => Math.round(n * 10000) / 10000;

/* ─── Main export ────────────────────────────────────────────────────────── */

export function applyFeedback(
  activity: Activity,
  action: FeedbackAction,
  now: number,
  globalWeightContext: GlobalWeightContext = {},
): Activity {
	const minWeight = getMinimumWeight(activity, globalWeightContext);
	const maxWeight = getMaximumWeight(activity, globalWeightContext);

  // ── skip ─────────────────────────────────────────────────────────────────
  if (action === 'skip') {
    // Streak intentionally preserved — skipping doesn't reset momentum.
    return activity;
  }

  // ── undo ─────────────────────────────────────────────────────────────────
  if (action === 'undo') {
    const delta = activity.lastAcceptDelta ?? 0;
    if (delta === 0) return activity; // nothing stored to reverse

    const next = roundTo4DecimalPlaces(clamp(activity.weight - delta, minWeight, maxWeight));
    return {
      ...activity,
      weight: next,
      lastAcceptDelta: undefined, // consumed — can't undo twice
      streak: 0,                  // reversal resets direction
    };
  }

  // ── reject ───────────────────────────────────────────────────────────────
  if (action === 'reject') {
    const { multiplier, newStreak } = getMomentumInfoFor(action, activity.streak);
    const factor = getDiminishingFactor(activity, 'negative', globalWeightContext);
    const delta = roundTo4DecimalPlaces(REJECT_STEP * multiplier * factor);
    const next = roundTo4DecimalPlaces(clamp(activity.weight - delta, minWeight, maxWeight));

    return {
      ...activity,
      weight: next,
      streak: newStreak,
      rejectCount: activity.rejectCount + 1,
      // lastAcceptDelta preserved — user may still want to undo a prior accept
    };
  }

  // ── hate ─────────────────────────────────────────────────────────────────
  // Large intentional negative step — always fully honoured (no dominance
  // guard equivalent on the negative side; we never suppress "I hate this").
  if (action === 'hate') {
    const { multiplier, newStreak } = getMomentumInfoFor(action, activity.streak);
    const factor = getDiminishingFactor(activity, 'negative', globalWeightContext);
    const delta = roundTo4DecimalPlaces(HATE_STEP * multiplier * factor);
    const next = roundTo4DecimalPlaces(clamp(activity.weight - delta, minWeight, maxWeight));

    return {
      ...activity,
      weight: next,
      streak: newStreak,
      rejectCount: activity.rejectCount + 1,
    };
  }

  // ── accept / boost ───────────────────────────────────────────────────────
  const baseStep = action === 'boost' ? BOOST_STEP : ACCEPT_STEP;
  const { multiplier, newStreak } = getMomentumInfoFor(action, activity.streak);
  const factor = getDiminishingFactor(activity, 'positive', globalWeightContext);
  let rawDelta = baseStep * multiplier * factor;

  // Dominance guard: only on 'accept', never on 'boost'.
  // If this activity already commands ≥ DOMINANCE_GUARD of the pool's
  // effective weight, mute further growth to a tenth — the user can still
  // move the needle with boost if they really want to.
  if (
    action === 'accept' &&
    globalWeightContext.totalEffectiveWeight !== undefined &&
    globalWeightContext.totalEffectiveWeight > 0
  ) {
    const share = getEffectiveWeight(activity, now, globalWeightContext) / globalWeightContext.totalEffectiveWeight;
    if (share > DOMINANCE_GUARD) rawDelta *= 0.1;
  }

  const delta = roundTo4DecimalPlaces(rawDelta);
  const next = roundTo4DecimalPlaces(clamp(activity.weight + delta, minWeight, maxWeight));

  return {
    ...activity,
    weight: next,
    streak: newStreak,
    acceptCount: activity.acceptCount + 1,
    lastAcceptDelta: delta, // stored so undo can reverse this exact amount
  };
}
