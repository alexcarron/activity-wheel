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
import { LOCAL_STORAGE_KEYS, loadJSONFromLocalStorage, saveJSONToLocalStorage } from '../utils/local-storage';

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
	const parsed = loadJSONFromLocalStorage<Partial<DebugState>>(LOCAL_STORAGE_KEYS.debugState, {});
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
		saveJSONToLocalStorage(LOCAL_STORAGE_KEYS.debugState, state);
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
