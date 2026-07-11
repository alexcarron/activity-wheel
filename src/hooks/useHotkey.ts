/**
 * Binds a global keydown shortcut for as long as the calling component is mounted (and `enabled` is true).
 * Design notes:
 * - Uses a ref for `handler` so the listener never needs to be torn down and re-added when the callback changes. Only `code` and `enabled` re-trigger the effect.
 * - Ignores key-repeat events so holding a key doesn't fire multiple times.
 * - Skips the shortcut when focus is inside a text input so typing is never interrupted.
 *
 * @param code - the event.code value from hotkeys.ts (e.g. 'Space', 'KeyY')
 * @param handler - called when the shortcut fires
 * @param enabled - set to false to temporarily disable without unmounting 
 */

import { useEffect, useLayoutEffect, useRef } from 'react';

export function useHotkey(code: string, handler: () => void, enabled: boolean = true): void {
	const handlerRef = useRef(handler);
	// Keep the ref in sync inside a layout-effect so we never mutate it
	// during render (which violates react-hooks/refs).
	useLayoutEffect(() => {
		handlerRef.current = handler;
	});

	useEffect(() => {
		if (!enabled) return;

		const onKeyDown = (event: KeyboardEvent): void => {
			if (event.code !== code || event.repeat) return;
			const tagName = (event.target as HTMLElement).tagName.toLowerCase();
			if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') return;
			event.preventDefault();
			handlerRef.current();
		};

		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, [code, enabled]); // handler intentionally excluded. Using ref instead
}
