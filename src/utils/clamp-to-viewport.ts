/**
 * Clamps a portal-positioned popover's top-left corner so a box of the given width/height stays within the visible viewport, accounting for scroll offset.
 */
export function clampToViewport(
	left: number,
	top: number,
	width: number,
	height: number,
	margin = 8,
): { top: number; left: number } {
	const maxLeft = window.scrollX + document.documentElement.clientWidth - width - margin;
	const maxTop = window.scrollY + document.documentElement.clientHeight - height - margin;
	return {
		left: Math.max(window.scrollX + margin, Math.min(left, maxLeft)),
		top: Math.max(window.scrollY + margin, Math.min(top, maxTop)),
	};
}
