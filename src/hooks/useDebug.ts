/**
 * `useDebug` — small toggleable debug context (weights, probabilities, seed).
 *
 * State is kept in `localStorage` only so debug preferences survive reloads.
 * No IndexedDB needed for two booleans + a string.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

const KEY = 'activity-wheel.debug';

export interface DebugState {
  showWeights: boolean;
  showProbabilities: boolean;
  /** Optional seed string for reproducible spins. Empty = random. */
  rngSeed: string;
}

const DEFAULT: DebugState = {
  showWeights: false,
  showProbabilities: false,
  rngSeed: '',
};

function read(): DebugState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    const parsed = JSON.parse(raw) as Partial<DebugState>;
    return {
      showWeights: !!parsed.showWeights,
      showProbabilities: !!parsed.showProbabilities,
      rngSeed: typeof parsed.rngSeed === 'string' ? parsed.rngSeed : '',
    };
  } catch {
    return DEFAULT;
  }
}

export interface UseDebugApi extends DebugState {
  setShowWeights(value: boolean): void;
  setShowProbabilities(value: boolean): void;
  setRngSeed(value: string): void;
}

export function useDebug(): UseDebugApi {
  const [state, setState] = useState<DebugState>(() => read());

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      // Ignore quota errors — debug mode is non-critical.
    }
  }, [state]);

  const setShowWeights = useCallback(
    (value: boolean) => setState((s) => ({ ...s, showWeights: value })),
    [],
  );
  const setShowProbabilities = useCallback(
    (value: boolean) => setState((s) => ({ ...s, showProbabilities: value })),
    [],
  );
  const setRngSeed = useCallback(
    (value: string) => setState((s) => ({ ...s, rngSeed: value })),
    [],
  );

  return useMemo<UseDebugApi>(
    () => ({ ...state, setShowWeights, setShowProbabilities, setRngSeed }),
    [state, setShowWeights, setShowProbabilities, setRngSeed],
  );
}
