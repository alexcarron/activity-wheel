/**
 * `useDebug`. Small toggleable debug context (weights, probabilities, seed).
 * State is kept in `localStorage` only so debug preferences survive reloads. No IndexedDB needed for two booleans + a string. 
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	SPREAD_FACTOR_DEFAULT,
	SPREAD_FACTOR_MAX,
	SPREAD_FACTOR_MAX_EXTENDED,
	SPREAD_FACTOR_MIN,
} from '../domain-logic/weight-logic/weight-constants';

const KEY = 'activity-wheel.debug';

export interface DebugState {
	showWeights: boolean;
	showProbabilities: boolean;
	/** Optional seed string for reproducible spins. Empty = random. */
	rngSeed: string;
	/** How much to exaggerate (>1) or compress (<1) differences between weights. 1 = unchanged. */
	spreadFactor: number;
	/** When true, the spread slider's range extends to SPREAD_FACTOR_MAX_EXTENDED. */
	allowExtremeSpread: boolean;
}

const DEFAULT: DebugState = {
	showWeights: false,
	showProbabilities: false,
	rngSeed: '',
	spreadFactor: SPREAD_FACTOR_DEFAULT,
	allowExtremeSpread: false,
};

function maxSpreadFactorFor(allowExtremeSpread: boolean): number {
	return allowExtremeSpread ? SPREAD_FACTOR_MAX_EXTENDED : SPREAD_FACTOR_MAX;
}

function clampSpreadFactor(value: number, allowExtremeSpread: boolean): number {
	return Math.min(maxSpreadFactorFor(allowExtremeSpread), Math.max(SPREAD_FACTOR_MIN, value));
}

function read(): DebugState {
	try {
		const raw = localStorage.getItem(KEY);
		if (!raw) return DEFAULT;
		const parsed = JSON.parse(raw) as Partial<DebugState>;
		const allowExtremeSpread = !!parsed.allowExtremeSpread;
		return {
			showWeights: !!parsed.showWeights,
			showProbabilities: !!parsed.showProbabilities,
			rngSeed: typeof parsed.rngSeed === 'string' ? parsed.rngSeed : '',
			spreadFactor:
				typeof parsed.spreadFactor === 'number'
					? clampSpreadFactor(parsed.spreadFactor, allowExtremeSpread)
					: SPREAD_FACTOR_DEFAULT,
			allowExtremeSpread,
		};
	}
	catch {
		return DEFAULT;
	}
}

export interface UseDebugApi extends DebugState {
	setShowWeights(value: boolean): void;
	setShowProbabilities(value: boolean): void;
	setRngSeed(value: string): void;
	setSpreadFactor(value: number): void;
	setAllowExtremeSpread(value: boolean): void;
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

	const setShowWeights = useCallback(
		(value: boolean) => setState((previousState) => ({ ...previousState, showWeights: value })),
		[],
	);
	const setShowProbabilities = useCallback(
		(value: boolean) =>
			setState((previousState) => ({ ...previousState, showProbabilities: value })),
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

	return useMemo<UseDebugApi>(
		() => ({
			...state,
			setShowWeights,
			setShowProbabilities,
			setRngSeed,
			setSpreadFactor,
			setAllowExtremeSpread,
		}),
		[
			state,
			setShowWeights,
			setShowProbabilities,
			setRngSeed,
			setSpreadFactor,
			setAllowExtremeSpread,
		],
	);
}
