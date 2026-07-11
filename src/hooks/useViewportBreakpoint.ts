/**
 * Tracks which named viewport breakpoint (see viewport-breakpoints.ts) the window currently falls into, re-rendering the calling component on a debounced resize. Lets components branch on screen size in JS the same way per-component .css files already branch on it with @media queries.
 * Usage: const { isPhone } = useViewportBreakpoint(); if (isPhone) { ... }
 */

import { useEffect, useState } from 'react';
import { VIEWPORT_BREAKPOINT_MAX_WIDTHS } from '../constants/viewport-breakpoints';
import type { ViewportBreakpoint } from '../constants/viewport-breakpoints';

const RESIZE_DEBOUNCE_MS = 150;

function getBreakpointForWidth(width: number): ViewportBreakpoint {
	if (width <= VIEWPORT_BREAKPOINT_MAX_WIDTHS.phone) return 'phone';
	if (width <= VIEWPORT_BREAKPOINT_MAX_WIDTHS.tablet) return 'tablet';
	if (width <= VIEWPORT_BREAKPOINT_MAX_WIDTHS.desktop) return 'desktop';
	return 'largeDesktop';
}

export interface ViewportBreakpointInfo {
	readonly breakpoint: ViewportBreakpoint;
	readonly isPhone: boolean;
	readonly isTablet: boolean;
	readonly isDesktop: boolean;
	readonly isLargeDesktop: boolean;
}

function toViewportBreakpointInfo(breakpoint: ViewportBreakpoint): ViewportBreakpointInfo {
	return {
		breakpoint,
		isPhone: breakpoint === 'phone',
		isTablet: breakpoint === 'tablet',
		isDesktop: breakpoint === 'desktop',
		isLargeDesktop: breakpoint === 'largeDesktop',
	};
}

export function useViewportBreakpoint(): ViewportBreakpointInfo {
	const [breakpoint, setBreakpoint] = useState<ViewportBreakpoint>(() =>
		getBreakpointForWidth(window.innerWidth),
	);

	useEffect(() => {
		let debounceTimeoutId = 0;
		const handleResize = (): void => {
			window.clearTimeout(debounceTimeoutId);
			debounceTimeoutId = window.setTimeout(() => {
				setBreakpoint(getBreakpointForWidth(window.innerWidth));
			}, RESIZE_DEBOUNCE_MS);
		};
		window.addEventListener('resize', handleResize);
		return () => {
			window.clearTimeout(debounceTimeoutId);
			window.removeEventListener('resize', handleResize);
		};
	}, []);

	return toViewportBreakpointInfo(breakpoint);
}
