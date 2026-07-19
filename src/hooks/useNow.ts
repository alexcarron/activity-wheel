/**
 * Returns the current time as a Unix-ms timestamp.
 */
import { useLayoutEffect, useReducer, useRef } from 'react';

// Captured once when the module is first imported. Not during render.
const _moduleBootTime = Date.now();

export function useNow(correctWhenChanged?: unknown): number {
	const moduleBootTimeRef = useRef(_moduleBootTime);
	const [, forceCorrectedRender] = useReducer((renderCount: number) => renderCount + 1, 0);

	useLayoutEffect(() => {
		moduleBootTimeRef.current = Date.now();
	});
	
	useLayoutEffect(() => {
		moduleBootTimeRef.current = Date.now();
		forceCorrectedRender();
	}, [correctWhenChanged]);
	
	// eslint-disable-next-line react-hooks/refs
	return moduleBootTimeRef.current;
}
