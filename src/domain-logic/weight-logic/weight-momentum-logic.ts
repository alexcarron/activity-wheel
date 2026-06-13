/**
 * Streak-based momentum multiplier.
 *
 * Rationale: repeated actions in the same direction feel more intentional
 * than a single click. Momentum rewards consistency without letting it
 * run away.
 *
 * Rules:
 *  - First action in any direction → 1.0× (no bonus).
 *  - Each consecutive same-direction action adds MOMENTUM_PER_STREAK.
 *  - Capped at MOMENTUM_MAX (2.0× by default).
 *  - Switching direction resets the streak to 1 in the new direction.
 *  - 'boost' counts as accept-direction for momentum purposes.
 *  - 'undo' and 'skip' reset the streak to 0 (no momentum for reversals).
 *
 * `prevStreak` convention (signed integer):
 *   > 0  consecutive accepts/boosts
 *   < 0  consecutive rejects
 *   = 0  neutral / just started
 */

import { MOMENTUM_MAX, MOMENTUM_PER_STREAK } from './weight-constants';

type MomentumDirection = 'positive' | 'negative' | 'neutral';

function getMomentumDirectionFromAction(action: string): MomentumDirection {
  if (action === 'accept' || action === 'boost') return 'positive';
  if (action === 'reject' || action === 'hate') return 'negative';
  return 'neutral'; // skip, undo → reset
}

/**
 * Given the current action and the previous streak value, return:
 *  - `multiplier` — the scale factor to apply to the base step
 *  - `newStreak`  — the updated signed streak to store on the activity
 */
export function getMomentumInfoFor(
  action: string,
  prevStreak: number,
): { multiplier: number; newStreak: number } {
  const momentumDirection = getMomentumDirectionFromAction(action);

  // Neutral actions don't earn momentum; they reset the streak.
  if (momentumDirection === 'neutral') {
    return { multiplier: 1, newStreak: 0 };
  }

  const isSameDirection =
    (momentumDirection === 'positive' && prevStreak > 0) ||
    (momentumDirection === 'negative' && prevStreak < 0);

  const newStreak = isSameDirection
    ? prevStreak + (momentumDirection === 'positive' ? 1 : -1)
    : momentumDirection === 'positive' ? 1 : -1;

  // "consecutive" = how many extra same-direction hits beyond the first.
  const consecutive = Math.abs(newStreak) - 1;
  const multiplier = Math.min(MOMENTUM_MAX, 1 + MOMENTUM_PER_STREAK * consecutive);

  return { multiplier, newStreak };
}
