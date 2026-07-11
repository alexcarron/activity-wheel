/**
 * Keyboard-shortcut badge rendered inside a button.
 * Styling adapts automatically to the button variant. Dark-background buttons (btn-primary, btn-accept, btn-reject) get a white-on-translucent look; all others get a muted dark-on-light look. This is handled by the `.btn-primary .kbd-hint` etc. selectors in styles/buttons.css, so this component stays purely presentational with zero variant props.
 * Usage: <button className="btn btn-primary"> Spin the wheel <KbdHint label="Space" /> </button>
 */

import './KbdHint.css';

interface KbdHintProps {
	readonly label: string;
}

export function KbdHint({ label }: KbdHintProps) {
	return (
		<kbd className="kbd-hint" aria-hidden="true">
			{label}
		</kbd>
	);
}
