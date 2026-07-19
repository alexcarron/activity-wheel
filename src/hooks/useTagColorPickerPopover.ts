/** Manages open/closed state and viewport-clamped position for a tag color picker popover anchored to a given element. */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { MouseEvent, RefObject } from 'react';
import { clampToViewport } from '../utils/clamp-to-viewport';

const ESTIMATED_PICKER_WIDTH = 220;
const ESTIMATED_PICKER_HEIGHT = 140;

export function useTagColorPickerPopover(anchorRef: RefObject<HTMLElement | null>) {
	const [isOpen, setIsOpen] = useState(false);
	const [position, setPosition] = useState({ top: 0, left: 0 });
	const popoverRef = useRef<HTMLDivElement>(null);

	const open = useCallback(
		(event: MouseEvent) => {
			event.preventDefault();
			if (anchorRef.current) {
				const rect = anchorRef.current.getBoundingClientRect();
				setPosition(
					clampToViewport(
						rect.left + window.scrollX,
						rect.bottom + window.scrollY + 4,
						ESTIMATED_PICKER_WIDTH,
						ESTIMATED_PICKER_HEIGHT,
					),
				);
			}
			setIsOpen(true);
		},
		[anchorRef],
	);

	const close = useCallback(() => setIsOpen(false), []);

	useLayoutEffect(() => {
		if (!isOpen || !popoverRef.current) return;
		const rect = popoverRef.current.getBoundingClientRect();
		const clamped = clampToViewport(
			rect.left + window.scrollX,
			rect.top + window.scrollY,
			rect.width,
			rect.height,
		);
		if (clamped.left !== rect.left + window.scrollX || clamped.top !== rect.top + window.scrollY) {
			setPosition(clamped);
		}
	}, [isOpen]);

	useEffect(() => {
		if (!isOpen) return;
		const handler = (event: globalThis.MouseEvent) => {
			const target = event.target as HTMLElement;
			if (!target.closest('.tag-color-picker')) {
				close();
			}
		};
		document.addEventListener('mousedown', handler);
		return () => document.removeEventListener('mousedown', handler);
	}, [isOpen, close]);

	return { isOpen, position, popoverRef, open, close };
}
