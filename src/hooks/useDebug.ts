/**
 * `useDebug`. Small toggleable debug context (per-value pill visibility, seed, weight spread).
 * State is kept in `localStorage` only so debug preferences survive reloads. No IndexedDB needed.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	DEFAULT_SPREAD_FACTOR,
	MAXIMUM_SPREAD_FACTOR,
	MAXIMUM_SPREAD_FACTOR_WHEN_EXTREME_ENABLED,
	MINIMUM_SPREAD_FACTOR,
} from '../domain-logic/weight-logic/weight-spread-logic';
import {
	createHiddenDebugValuePillKeyToIsVisible,
	DEBUG_VALUE_PILL_KEYS,
	type DebugValuePillKey,
} from '../components/debug-value-pills';

const KEY = 'activity-wheel.debug';

export interface DebugState {
	/** Which debug value pills are currently shown on each activity row. */
	debugValuePillKeyToIsVisible: Record<DebugValuePillKey, boolean>;
	/** Optional seed string for reproducible spins. Empty = random. */
	rngSeed: string;
	/** How much to increase (>1) or decrease (<1) the differences between weights. 1 = unchanged. */
	spreadFactor: number;
	/** When true, the spread slider's range extends to MAXIMUM_SPREAD_FACTOR_WHEN_EXTREME_ENABLED. */
	allowExtremeSpread: boolean;
	/** When true, the wheel sizes its slices by each activity's locked actual current weight instead of its estimated stable weight. */
	sizeWheelByActualCurrentWeights: boolean;
}

const DEFAULT: DebugState = {
	debugValuePillKeyToIsVisible: createHiddenDebugValuePillKeyToIsVisible(),
	rngSeed: '',
	spreadFactor: DEFAULT_SPREAD_FACTOR,
	allowExtremeSpread: false,
	sizeWheelByActualCurrentWeights: false,
};

function maxSpreadFactorFor(allowExtremeSpread: boolean): number {
	return allowExtremeSpread ? MAXIMUM_SPREAD_FACTOR_WHEN_EXTREME_ENABLED : MAXIMUM_SPREAD_FACTOR;
}

function clampSpreadFactor(value: number, allowExtremeSpread: boolean): number {
	return Math.min(maxSpreadFactorFor(allowExtremeSpread), Math.max(MINIMUM_SPREAD_FACTOR, value));
}

function readDebugValuePillKeyToIsVisible(parsed: Partial<DebugState>): Record<DebugValuePillKey, boolean> {
	const debugValuePillKeyToIsVisible = createHiddenDebugValuePillKeyToIsVisible();
	const stored = parsed.debugValuePillKeyToIsVisible;
	if (stored && typeof stored === 'object') {
		for (const key of DEBUG_VALUE_PILL_KEYS) debugValuePillKeyToIsVisible[key] = !!stored[key];
	}
	return debugValuePillKeyToIsVisible;
}

function read(): DebugState {
	try {
		const raw = localStorage.getItem(KEY);
		if (!raw) return DEFAULT;
		const parsed = JSON.parse(raw) as Partial<DebugState>;
		const allowExtremeSpread = !!parsed.allowExtremeSpread;
		return {
			debugValuePillKeyToIsVisible: readDebugValuePillKeyToIsVisible(parsed),
			rngSeed: typeof parsed.rngSeed === 'string' ? parsed.rngSeed : '',
			spreadFactor:
				typeof parsed.spreadFactor === 'number'
					? clampSpreadFactor(parsed.spreadFactor, allowExtremeSpread)
					: DEFAULT_SPREAD_FACTOR,
			allowExtremeSpread,
			sizeWheelByActualCurrentWeights: !!parsed.sizeWheelByActualCurrentWeights,
		};
	}
	catch {
		return DEFAULT;
	}
}

export interface UseDebugApi extends DebugState {
	setValuePillVisible(key: DebugValuePillKey, value: boolean): void;
	setRngSeed(value: string): void;
	setSpreadFactor(value: number): void;
	setAllowExtremeSpread(value: boolean): void;
	setSizeWheelByActualCurrentWeights(value: boolean): void;
}

export function useDebug(): UseDebugApi {
	const [state, setState] = useState<DebugState>(() => read());

	useEffect(() => {
		try {
			localStorage.setItem(KEY, JSON.stringify(state));
		}
		catch {
			// Ignore quota errors. Debug mode is non-critical.
		}
	}, [state]);

	const setValuePillVisible = useCallback(
		(key: DebugValuePillKey, value: boolean) =>
			setState((previousState) => ({
				...previousState,
				debugValuePillKeyToIsVisible: { ...previousState.debugValuePillKeyToIsVisible, [key]: value },
			})),
		[],
	);
	const setRngSeed = useCallback(
		(value: string) => setState((previousState) => ({ ...previousState, rngSeed: value })),
		[],
	);
	const setSpreadFactor = useCallback(
		(value: number) =>
			setState((previousState) => ({
				...previousState,
				spreadFactor: clampSpreadFactor(value, previousState.allowExtremeSpread),
			})),
		[],
	);
	const setAllowExtremeSpread = useCallback(
		(value: boolean) =>
			setState((previousState) => ({
				...previousState,
				allowExtremeSpread: value,
				spreadFactor: clampSpreadFactor(previousState.spreadFactor, value),
			})),
		[],
	);
	const setSizeWheelByActualCurrentWeights = useCallback(
		(value: boolean) => setState((previousState) => ({ ...previousState, sizeWheelByActualCurrentWeights: value })),
		[],
	);

	return useMemo<UseDebugApi>(
		() => ({
			...state,
			setValuePillVisible,
			setRngSeed,
			setSpreadFactor,
			setAllowExtremeSpread,
			setSizeWheelByActualCurrentWeights,
		}),
		[state, setValuePillVisible, setRngSeed, setSpreadFactor, setAllowExtremeSpread, setSizeWheelByActualCurrentWeights],
	);
}
