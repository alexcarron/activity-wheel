import { SVG_ICON_OUTLINE_STROKE_WIDTH } from './svg-icon-constants';

export function TagIcon({ isCrossedOut }: { isCrossedOut: boolean }) {
	return (
		<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
			<path
				fillRule="evenodd"
				clipRule="evenodd"
				d="M1.5 1.5H6.5L12.5 7.5L7.5 12.5L1.5 6.5V1.5Z M5 4a1 1 0 1 1 -2 0a1 1 0 1 1 2 0Z"
				fill="currentColor"
			/>
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
