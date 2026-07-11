/**
 * Single source of truth for the pixel cutoffs between named viewport breakpoints. These values must stay in sync with the `@media` cutoffs used across the per-component `.css` files (phone: max-width 599px, tablet: 600-1023px, desktop: 1024-1439px, largeDesktop: 1440px+). Used by useViewportBreakpoint so JS-driven layout decisions match the CSS ones.
 */
export const VIEWPORT_BREAKPOINT_MAX_WIDTHS = {
	phone: 599,
	tablet: 1023,
	desktop: 1439,
} as const;

export type ViewportBreakpoint = 'phone' | 'tablet' | 'desktop' | 'largeDesktop';
