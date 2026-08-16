import { SVG_ICON_OUTLINE_STROKE_WIDTH } from './svg-icon-constants';

export function TrashIcon() {
	return (
		<svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
			<path
				d="M2 4h12M5.5 4V3a.5.5 0 0 1 .5-.5h4a.5.5 0 0 1 .5.5v1M3 4l.75 8a.75.75 0 0 0 .75.7h8a.75.75 0 0 0 .75-.7L13 4"
				stroke="currentColor"
				strokeWidth={SVG_ICON_OUTLINE_STROKE_WIDTH}
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<line x1="6" y1="7" x2="6" y2="11" stroke="currentColor" strokeWidth={SVG_ICON_OUTLINE_STROKE_WIDTH} strokeLinecap="round" />
			<line x1="10" y1="7" x2="10" y2="11" stroke="currentColor" strokeWidth={SVG_ICON_OUTLINE_STROKE_WIDTH} strokeLinecap="round" />
		</svg>
	);
}
