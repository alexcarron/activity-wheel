import { SVG_ICON_OUTLINE_STROKE_WIDTH } from './svg-icon-constants';

export function CheckIcon() {
	return (
		<svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
			<path
				d="M2 5l2.5 2.5 4-4"
				stroke="white"
				strokeWidth={SVG_ICON_OUTLINE_STROKE_WIDTH}
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}
