import type { CSSProperties } from 'react';
import { DEBUG_VALUE_PILLS, type DebugValuePillKey } from './debug-value-pills';

/** Returns a pill that is filled like a bar chart from red at the lowest values, through orange-yellow in the middle, to green at the highest values. */
function getBarPillStyle(value: number, min: number, max: number): CSSProperties {
	const range = max - min;
	const normalizedPosition = range === 0 ? 1 : Math.max(0, Math.min(1, (value - min) / range));

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
		background: `linear-gradient(to right, ${fillColor} ${fillPercent}%, var(--bg-soft) ${fillPercent}%)`,
		borderColor,
	};
}

export function DebugValuePills({
	values,
	ranges,
	visibility,
}: {
	values: Record<DebugValuePillKey, number> | null;
	ranges: Record<DebugValuePillKey, { min: number; max: number }>;
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
				return (
					<span
						key={pill.key}
						className="meta-pill"
						style={getBarPillStyle(value, range.min, range.max)}
						title={pill.pillTooltip}
					>
						{pill.pillLabel} {pill.format(value)}
					</span>
				);
			})}
		</>
	);
}
