/**
 * Single source of truth for every keyboard shortcut in the app.
 * - code: The code of the physical key that was pressed on a keyboard
 * - label: Human-readable string shown in the hint badge
 * Add new shortcuts here first, then wire them up with `useHotkey` and show them with `<KbdHint>`. 
 */

export const HOTKEYS = {
	SPIN_WHEEL: {
		code: 'Space',
		label: 'Space',
	},
	LOVE_IT: {
		code: 'KeyL',
		label: 'L',
	},
	ACCEPT: {
		code: 'KeyY',
		label: 'Y',
	},
	SKIP: {
		code: 'KeyS',
		label: 'S',
	},
	REJECT: {
		code: 'KeyN',
		label: 'N',
	},
	HATE_IT: {
		code: 'KeyH',
		label: 'H',
	},
	SWITCH_TO_PREV_WHEEL: {
		code: 'BracketLeft',
		label: '[',
	},
	SWITCH_TO_NEXT_WHEEL: {
		code: 'BracketRight',
		label: ']',
	},
} as const;

/**
 * Digit hotkeys for toggling the top-9 most-popular tags. 
 */
export const TAG_HOTKEYS = [
	{ code: 'Digit1', label: '1' },
	{ code: 'Digit2', label: '2' },
	{ code: 'Digit3', label: '3' },
	{ code: 'Digit4', label: '4' },
	{ code: 'Digit5', label: '5' },
	{ code: 'Digit6', label: '6' },
	{ code: 'Digit7', label: '7' },
	{ code: 'Digit8', label: '8' },
	{ code: 'Digit9', label: '9' },
] as const;
