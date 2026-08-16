import './KeyboardHint.css';

interface KeyboardHintProps {
	readonly label: string;
	readonly variant?: 'default' | 'tagPill';
}

export function KeyboardHint({ label, variant = 'default' }: KeyboardHintProps) {
	const variantClassName = variant === 'tagPill' ? ' keyboard-hint-tag-pill' : '';
	return (
		<kbd className={`keyboard-hint${variantClassName}`} aria-hidden="true">
			{label}
		</kbd>
	);
}
