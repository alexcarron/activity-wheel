import type { CSSProperties } from 'react';
import { DEBUG_VALUE_PILLS, type DebugValuePillKey, type DebugValuePillRange } from './debug-value-pills';

/** Returns a pill style filled like a bar chart from red at normalizedPosition 0, through orange-yellow at 0.5, to green at 1. */
function getBarPillStyle(normalizedPosition: number): CSSProperties {
	let red: number, green: number, blue: number;
	if (normalizedPosition <= 0.5) {
		const blendRatio = normalizedPosition * 2;
		red = Math.round(201 + (240 - 201) * blendRatio);
		green = Math.round(42 + (140 - 42) * blendRatio);
		blue = Math.round(42 + (0 - 42) * blendRatio);
	}
	else {
		const blendRatio = (normalizedPosition - 0.5) * 2;
		red = Math.round(240 + (55 - 240) * blendRatio);
		green = Math.round(140 + (178 - 140) * blendRatio);
		blue = Math.round(0 + (77 - 0) * blendRatio);
	}

	const fillPercent = 5 + normalizedPosition * 95;
	const fillColor = `rgba(${red}, ${green}, ${blue}, 0.55)`;
	const borderColor = `rgb(${red}, ${green}, ${blue})`;

	return {
		background: `linear-gradient(to right, ${fillColor} ${fillPercent}%, var(--soft-background-color) ${fillPercent}%)`,
		borderColor,
	};
}

export function DebugValuePills({
	values,
	ranges,
	visibility,
}: {
	values: Record<DebugValuePillKey, number> | null;
	ranges: Record<DebugValuePillKey, DebugValuePillRange>;
	visibility: Record<DebugValuePillKey, boolean>;
}) {
	if (!values) return null;
	const visiblePills = DEBUG_VALUE_PILLS.filter((pill) => visibility[pill.key]);
	if (visiblePills.length === 0) return null;
	return (
		<>
			{visiblePills.map((pill) => {
				const value = values[pill.key];
				const range = ranges[pill.key] ?? { min: 0, max: 1 };
				const normalizedPosition = pill.getNormalizedFillPosition(value, range);
				return (
					<span
						key={pill.key}
						className="meta-pill"
						style={getBarPillStyle(normalizedPosition)}
						title={pill.pillTooltip}
					>
						{pill.pillLabel} {pill.format(value)}
					</span>
				);
			})}
		</>
	);
}
