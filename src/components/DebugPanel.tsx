/**
 * Toggleable debug panel. Exposes a show/hide checkbox for each debug value pill, an optional RNG seed for reproducible spins, and the weight spread controls.
 * Persisted to localStorage so it survives page reloads.
 */

import type { UseDebugApi } from '../hooks/useDebug';
import { DEBUG_VALUE_PILLS } from './debug-value-pills';
import {
	MAXIMUM_SPREAD_FACTOR,
	MAXIMUM_SPREAD_FACTOR_WHEN_EXTREME_ENABLED,
	sliderPositionToSpreadFactor,
	spreadFactorToSliderPosition,
} from '../domain-logic/weight-logic/weight-spread-logic';
import './DebugPanel.css';

interface Props {
	readonly debug: UseDebugApi;
}

export function DebugPanel({ debug }: Props) {
	const spreadMax = debug.allowExtremeSpread
		? MAXIMUM_SPREAD_FACTOR_WHEN_EXTREME_ENABLED
		: MAXIMUM_SPREAD_FACTOR;
	return (
		<details className="debug-panel">
			<summary className="debug-panel-summary">Debug</summary>
			<div className="debug-panel-body">
				{DEBUG_VALUE_PILLS.map((pill) => (
					<label className="debug-row" key={pill.key} title={pill.pillTooltip}>
						<input
							type="checkbox"
							checked={debug.debugValuePillKeyToIsVisible[pill.key]}
							onChange={(event) => debug.setValuePillVisible(pill.key, event.target.checked)}
						/>
						{pill.checkboxLabel}
					</label>
				))}
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
					Allow extreme weight spread (up to {MAXIMUM_SPREAD_FACTOR_WHEN_EXTREME_ENABLED}×)
				</label>
				<label className="debug-row" title="Size the wheel's slices by each activity's actual current weight (the locked per-spin value) instead of its estimated stable weight">
					<input
						type="checkbox"
						checked={debug.sizeWheelByActualCurrentWeights}
						onChange={(event) => debug.setSizeWheelByActualCurrentWeights(event.target.checked)}
					/>
					Size wheel slices by actual current weights
				</label>
			</div>
		</details>
	);
}
