import type { ReactNode } from 'react';
import './IconToggleButton.css';

interface IconToggleButtonProps {
	readonly isActive?: boolean;
	readonly title: string;
	readonly children: ReactNode;
	onClick(): void;
}

export function IconToggleButton({ isActive = false, title, children, onClick }: IconToggleButtonProps) {
	return (
		<button
			type="button"
			className={`icon-toggle-button${isActive ? ' is-active' : ''}`}
			onClick={onClick}
			title={title}
			aria-pressed={isActive}
			aria-label={title}
		>
			{children}
		</button>
	);
}
