/**
 * Toggleable debug panel. Exposes:
 * - Show weights
 * - Show probabilities
 * - Optional RNG seed (for reproducible spins)
 * Persisted to localStorage so it survives page reloads. 
 */

import type { UseDebugApi } from '../hooks/useDebug';
import {
	SPREAD_FACTOR_MAX,
	SPREAD_FACTOR_MAX_EXTENDED,
} from '../domain-logic/weight-logic/weight-constants';
import {
	sliderPositionToSpreadFactor,
	spreadFactorToSliderPosition,
} from '../domain-logic/weight-logic/weight-spread-logic';
import './DebugPanel.css';

interface Props {
	readonly debug: UseDebugApi;
}

export function DebugPanel({ debug }: Props) {
	const spreadMax = debug.allowExtremeSpread ? SPREAD_FACTOR_MAX_EXTENDED : SPREAD_FACTOR_MAX;
	return (
		<details className="debug-panel">
			<summary className="debug-panel-summary">Debug</summary>
			<div className="debug-panel-body">
				<label className="debug-row">
					<input
						type="checkbox"
						checked={debug.showWeights}
						onChange={(event) => debug.setShowWeights(event.target.checked)}
					/>
					Show weights
				</label>
				<label className="debug-row">
					<input
						type="checkbox"
						checked={debug.showProbabilities}
						onChange={(event) => debug.setShowProbabilities(event.target.checked)}
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
						onChange={(event) => debug.setRngSeed(event.target.value)}
					/>
				</label>
				<label className="debug-row debug-row-stack">
					<span>Weight spread ({debug.spreadFactor.toFixed(1)})</span>
					<input
						type="range"
						className="debug-slider"
						min={0}
						max={1}
						step={0.001}
						value={spreadFactorToSliderPosition(debug.spreadFactor, spreadMax)}
						onChange={(event) =>
							debug.setSpreadFactor(sliderPositionToSpreadFactor(Number(event.target.value), spreadMax))
						}
					/>
				</label>
				<label className="debug-row">
					<input
						type="checkbox"
						checked={debug.allowExtremeSpread}
						onChange={(event) => debug.setAllowExtremeSpread(event.target.checked)}
					/>
					Allow extreme weight spread (up to {SPREAD_FACTOR_MAX_EXTENDED}×)
				</label>
			</div>
		</details>
	);
}
