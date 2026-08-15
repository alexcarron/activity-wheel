/**
 * `useWheel`. Coordinates a spin from start to finish.
 * Flow: the user clicks Spin, we compute the picked activity immediately using the seeded selection algorithm, we compute the target rotation that lands the picked slice under the pointer (plus a few full revolutions for feel), and the wheel component animates to that rotation and calls `onComplete()` when done, flipping us into the post-spin state.
 * The animation is only a presentation of the already-known answer. This keeps selection unbiased (no slot-machine near-miss corrections) and animation predictable (no surprise about how it landed).
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import type { Activity } from '../../domain-logic/types';
import {
	applySpreadToWeights,
	DEFAULT_SPREAD_FACTOR,
} from '../../domain-logic/weight-logic/weight-spread-logic';
import { useSpinCount } from '../../context/SpinCountContext';
import { pickFromWeightedItems } from '../../domain-logic/weighted-selection-logic';
import { makeRng } from '../../utils/random-utils';
import { getNextSpinTiming } from './spin-duration-logic';

export type WheelPhase = 'idle' | 'spinning' | 'landed';

interface SpinResult {
	/** Index of the picked slice within the activities passed to spin. */
	index: number;
	/** The picked activity. */
	activity: Activity;
	/** Final rotation in degrees that lands the picked slice under the pointer. */
	targetRotationDeg: number;
}

export interface UseWheelApi {
	readonly phase: WheelPhase;
	readonly result: SpinResult | null;
	readonly rotationDeg: number;
	/** Returns true if a spin was actually started. */
	spin(input: { activities: readonly Activity[]; weights: readonly number[]; seed?: string; spreadFactor?: number }): boolean;
	/** Called by the wheel component when the animation completes. */
	finish(): void;
	/** Resets to idle without consuming the result; used after accepting/rejecting/skipping. */
	resetWheel(): void;
	/** Resets both wheel and spinCount; used when explicitly resetting the session. */
	resetWheelAndSession(): void;
}

export function useWheel(): UseWheelApi {
	const spinCountContext = useSpinCount();
	const [phase, setPhase] = useState<WheelPhase>('idle');
	const [result, setResult] = useState<SpinResult | null>(null);
	const [rotationDeg, setRotationDeg] = useState(0);
	const rotationRef = useRef(0);

	const spin = useCallback(
		({
			activities,
			weights,
			seed,
			spreadFactor = DEFAULT_SPREAD_FACTOR,
		}: {
			activities: readonly Activity[];
			weights: readonly number[];
			seed?: string;
			spreadFactor?: number;
		}): boolean => {
			if (activities.length === 0) return false;
			if (phase === 'spinning') return false;

			const rng = makeRng(seed);
			const spreadWeights = applySpreadToWeights(weights, spreadFactor);
			const weightedActivities = activities.map((activity, index) => ({
				item: activity,
				weight: spreadWeights[index],
			}));
			const pickedActivity = pickFromWeightedItems({ weightedItems: weightedActivities, rng });
			if (!pickedActivity) return false;

			const pickedActivityIndex = activities.indexOf(pickedActivity);
			if (pickedActivityIndex < 0) return false;

			const totalWeight = weightedActivities.reduce((sum, entry) => sum + entry.weight, 0);
			let weightBeforePickedActivity = 0;
			for (let precedingIndex = 0; precedingIndex < pickedActivityIndex; precedingIndex++) {
				weightBeforePickedActivity += weightedActivities[precedingIndex].weight;
			}

			let sliceCenterFromTop: number;
			if (totalWeight > 0) {
				sliceCenterFromTop = ((weightBeforePickedActivity + weightedActivities[pickedActivityIndex].weight / 2) / totalWeight) * 360;
			}
			else {
				sliceCenterFromTop = (pickedActivityIndex + 0.5) * (360 / activities.length);
			}

			const baseAlignment = (360 - sliceCenterFromTop) % 360;
			const currentRotation = rotationRef.current;
			const currentRotationMod = ((currentRotation % 360) + 360) % 360;
			let rotationDelta = baseAlignment - currentRotationMod;
			if (rotationDelta < 0) rotationDelta += 360;

			const spinTiming = getNextSpinTiming(spinCountContext.spinCount);
			SPIN_TIMING.durationMs = spinTiming.durationMs;
			SPIN_TIMING.fullRotations = spinTiming.fullRotations;

			spinCountContext.incrementSpinCount();

			const targetRotationDeg = currentRotation + spinTiming.fullRotations * 360 + rotationDelta;

			setResult({ index: pickedActivityIndex, activity: pickedActivity, targetRotationDeg });
			setPhase('spinning');
			return true;
		},
		[phase, spinCountContext],
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
 * Mutable timing object shared with Wheel.tsx. Values are updated in-place by `spin()` before each animation starts, so Wheel.tsx always reads the correct duration for the current spin. Initial values match the first-spin defaults from `getNextSpinTiming`.
 */
export const SPIN_TIMING = {
	durationMs: 2_000,
	fullRotations: 7,
};
