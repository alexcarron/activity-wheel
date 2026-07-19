/**
 * `useWheel`. Coordinates a spin from start to finish.
 * Flow: 1. The user clicks Spin. 2. We compute the *winner* immediately using the seeded selection algorithm. The animation is only a presentation of that already-known answer. 3. We compute the target rotation that will make the winning slice align with the pointer at the top, plus a few full revolutions for feel. 4. The wheel component animates from current to target rotation; on done, it calls `onComplete()` to flip us into the post-spin state.
 * This separation keeps:
 * - selection unbiased (no slot-machine "near miss" corrections),
 * - animation predictable (no "how did it land?" surprise after the fact). 
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import type { Activity } from '../../domain-logic/types';
import {
	applySpreadToWeights,
	DEFAULT_SPREAD_FACTOR,
} from '../../domain-logic/weight-logic/weight-spread-logic';
import { getEffectiveWeight } from '../../domain-logic/weight-logic/effective-weight-logic';
import { useWeightContext } from '../../context/WeightContext';
import { useSpinCount } from '../../context/SpinCountContext';
import { pickFromWeightedPool } from '../../domain-logic/weighted-selection-logic';
import { makeRng } from '../../utils/random-utils';
import { getNextSpinTiming } from './spin-duration-logic';

export type WheelPhase = 'idle' | 'spinning' | 'landed';

interface SpinResult {
	/** Index of the winning slice within the *current* pool. */
	index: number;
	/** Winning activity. */
	activity: Activity;
	/** Final rotation in degrees that will land slice center under the pointer. */
	targetRotationDeg: number;
}

export interface UseWheelApi {
	readonly phase: WheelPhase;
	readonly result: SpinResult | null;
	readonly rotationDeg: number;
	/** Returns true if a spin was actually started. */
	spin(pool: readonly Activity[], seed?: string, spreadFactor?: number): boolean;
	/** Called by the wheel component when the animation completes. */
	finish(): void;
	/** Resets to idle without consuming the result; used after accepting/rejecting/skipping. */
	resetWheel(): void;
	/** Resets both wheel and spinCount; used when explicitly resetting the session. */
	resetWheelAndSession(): void;
}

export function useWheel(): UseWheelApi {
	const globalWeightContext = useWeightContext();
	const spinCountContext = useSpinCount();
	const [phase, setPhase] = useState<WheelPhase>('idle');
	const [result, setResult] = useState<SpinResult | null>(null);
	const [rotationDeg, setRotationDeg] = useState(0);
	const rotationRef = useRef(0);

	const spin = useCallback(
		(
			pool: readonly Activity[],
			seed?: string,
			spreadFactor: number = DEFAULT_SPREAD_FACTOR,
		): boolean => {
			if (pool.length === 0) return false;
			if (phase === 'spinning') return false;

			const now = Date.now();
			const effectiveWeights = pool.map((activity) =>
				getEffectiveWeight(activity, now, globalWeightContext),
			);
			const spreadWeights = applySpreadToWeights(effectiveWeights, spreadFactor);
			const weighted = pool.map((activity, index) => ({
				item: activity,
				weight: spreadWeights[index],
			}));
			const rng = makeRng(seed);
			const winner = pickFromWeightedPool(weighted, rng);
			if (!winner) return false;

			const index = pool.indexOf(winner);
			if (index < 0) return false;

			// Slice 0's left edge is at 12 o'clock (top) when rotation = 0.
			// Each slice's arc is proportional to its effective weight.
			// The center of slice i is therefore at:
			//   (cumulative_weight_before_i + weight_i / 2) / totalWeight * 360  degrees CW from top.
			// Rotating by (360 − sliceCenterFromTop) % 360 brings that center to the pointer.
			// For equal weights this reduces to (i + 0.5) * (360 / n), matching the old formula.
			const totalWeight = weighted.reduce((sum, entry) => sum + entry.weight, 0);
			let cumulativeWeight = 0;
			for (let j = 0; j < index; j++) cumulativeWeight += weighted[j].weight;
			const sliceCenterFromTop =
				totalWeight > 0
					? ((cumulativeWeight + weighted[index].weight / 2) / totalWeight) * 360
					: (index + 0.5) * (360 / pool.length);
			const baseAlignment = (360 - sliceCenterFromTop) % 360;
			// Always go "forward". Accumulate rotation rather than snapping back.
			const current = rotationRef.current;
			const currentMod = ((current % 360) + 360) % 360;
			let delta = baseAlignment - currentMod;
			if (delta < 0) delta += 360;

			// Compute dynamic timing for this spin using the current spinCount from context.
			const spinTiming = getNextSpinTiming(spinCountContext.spinCount);
			SPIN_TIMING.durationMs = spinTiming.durationMs;
			SPIN_TIMING.fullRotations = spinTiming.fullRotations;

			// Increment spinCount in context
			spinCountContext.incrementSpinCount();

			const target = current + spinTiming.fullRotations * 360 + delta;

			setResult({ index, activity: winner, targetRotationDeg: target });
			setPhase('spinning');
			return true;
		},
		[phase, globalWeightContext, spinCountContext],
	);

	const finish = useCallback((): void => {
		setPhase((current) => (current === 'spinning' ? 'landed' : current));
		setResult((previousResult) => {
			if (previousResult) {
				rotationRef.current = previousResult.targetRotationDeg;
				setRotationDeg(previousResult.targetRotationDeg);
			}
			return previousResult;
		});
	}, []);

	const resetWheel = useCallback((): void => {
		setPhase('idle');
		setResult(null);
		// Note: Do NOT reset spinCount here. spinCount persists across results.
		// Only reset spinCount when explicitly resetting the session via resetWheelAndSession().
	}, []);

	const resetWheelAndSession = useCallback((): void => {
		setPhase('idle');
		setResult(null);
		spinCountContext.resetSpinCount();
	}, [spinCountContext]);

	return useMemo<UseWheelApi>(
		() => ({ phase, result, rotationDeg, spin, finish, resetWheel, resetWheelAndSession }),
		[phase, result, rotationDeg, spin, finish, resetWheel, resetWheelAndSession],
	);
}

/**
 * Mutable timing object shared with Wheel.tsx. Values are updated in-place by `spin()` before each animation starts, so Wheel.tsx always reads the correct duration for the current spin. Initial values match the first-spin defaults from useSpinDuration. 
 */
export const SPIN_TIMING = {
	durationMs: 2_000,
	fullRotations: 7,
};
