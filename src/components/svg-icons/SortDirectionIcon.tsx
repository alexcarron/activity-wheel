import type { SortDirection } from '../../domain-logic/types';
import { SVG_ICON_OUTLINE_STROKE_WIDTH } from './svg-icon-constants';

export function SortDirectionIcon({ sortDirection }: { sortDirection: SortDirection }) {
	const arrowPath = sortDirection === 'asc' ? 'M7 12V2 M7 2L3 6 M7 2L11 6' : 'M7 2V12 M7 12L3 8 M7 12L11 8';
	return (
		<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
			<path
				d={arrowPath}
				stroke="currentColor"
				strokeWidth={SVG_ICON_OUTLINE_STROKE_WIDTH}
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}
