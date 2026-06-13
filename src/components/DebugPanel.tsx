/**
 * Toggleable debug panel. Exposes:
 *  - Show weights
 *  - Show probabilities
 *  - Optional RNG seed (for reproducible spins)
 *
 * Persisted to localStorage so it survives page reloads.
 */

import type { UseDebugApi } from '../hooks/useDebug';

interface Props {
  readonly debug: UseDebugApi;
}

export function DebugPanel({ debug }: Props) {
  return (
    <details className="debug-panel">
      <summary className="debug-panel-summary">Debug</summary>
      <div className="debug-panel-body">
        <label className="debug-row">
          <input
            type="checkbox"
            checked={debug.showWeights}
            onChange={(e) => debug.setShowWeights(e.target.checked)}
          />
          Show weights
        </label>
        <label className="debug-row">
          <input
            type="checkbox"
            checked={debug.showProbabilities}
            onChange={(e) => debug.setShowProbabilities(e.target.checked)}
          />
          Show probabilities
        </label>
        <label className="debug-row debug-row-stack">
          <span>RNG seed (blank for random)</span>
          <input
            type="text"
            className="debug-seed"
            placeholder="e.g. friday-night"
            value={debug.rngSeed}
            onChange={(e) => debug.setRngSeed(e.target.value)}
          />
        </label>
      </div>
    </details>
  );
}
