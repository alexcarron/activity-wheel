import { SVG_ICON_OUTLINE_STROKE_WIDTH } from './svg-icon-constants';

export function CalendarIcon({ isCrossedOut }: { isCrossedOut: boolean }) {
	return (
		<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
			<rect x="1.5" y="3" width="11" height="9.5" rx="1.5" fill="currentColor" />
			<rect x="3.25" y="1" width="1.5" height="3" rx="0.75" fill="currentColor" />
			<rect x="9.25" y="1" width="1.5" height="3" rx="0.75" fill="currentColor" />
			{isCrossedOut && (
				<line
					x1="1.5"
					y1="12.5"
					x2="12.5"
					y2="1.5"
					stroke="currentColor"
					strokeWidth={SVG_ICON_OUTLINE_STROKE_WIDTH}
					strokeLinecap="round"
				/>
			)}
		</svg>
	);
}
