/**
 * Single source of truth for every keyboard shortcut in the app.
 *
 * `code`  — e.code value (layout-independent, works regardless of OS language)
 * `label` — human-readable string shown in the KbdHint badge
 *
 * Add new shortcuts here first, then wire them up with `useHotkey` and show
 * them with `<KbdHint>`. Nothing else in the codebase hard-codes key names.
 */

export const HOTKEYS = {
  /** Spin the wheel (idle) or spin again (landed). */
  SPIN: { 
		code: 'Space', 
		label: 'Space' 
	},
  /** Super Fun! — large weight boost (boost action). Mnemonic: F = Fun. */
  SUPER_FUN: { 
		code: 'KeyF', 
		label: 'F' 
	},
  /** Accept the landed activity (moderate weight boost). */
  ACCEPT: { 
		code: 'KeyY', 
		label: 'Y' 
	},
  /** Skip the landed activity (no weight change). */
  SKIP: { 
		code: 'KeyS', 
		label: 'S' 
	},
  /** Reject the landed activity (lower weight). */
  REJECT: {
		code: 'KeyN',
		label: 'N'
	},
  /** Hate It! — large weight penalty (hate action). Mnemonic: H = Hate. */
  HATE_IT: {
		code: 'KeyH',
		label: 'H'
	},
  /** Switch to the previous wheel (cycle left). */
  PREV_WHEEL: { 
		code: 'BracketLeft',  
		label: '[' 
	},
/** Switch to the next wheel (cycle right). */
  NEXT_WHEEL: { 
		code: 'BracketRight', 
		label: ']' 
	},
} as const;

/**
 * Digit hotkeys (1–9) for toggling the top-9 most-popular tags.
 * Wired up dynamically in TagFilterBar based on the sorted tag list.
 * Index 0 → Digit1 → most popular tag, index 8 → Digit9 → 9th most popular.
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
