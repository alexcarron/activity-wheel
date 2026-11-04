/** Small auto-dismissing banner, e.g. for "Wheel updated by another user." notices. */

import { useEffect } from 'react';
import './Toast.css';

interface ToastProps {
	message: string;
	onDismiss(): void;
	/** Milliseconds before auto-dismiss. */
	durationMs?: number;
	action?: {
		label: string;
		onClick(): void;
	};
}

export function Toast({ message, onDismiss, durationMs = 4000, action }: ToastProps) {
	useEffect(() => {
		const timer = setTimeout(onDismiss, durationMs);
		return () => clearTimeout(timer);
	}, [onDismiss, durationMs]);

	return (
		<div className="toast" role="status">
			<span className="toast-message">{message}</span>
			{action && (
				<button type="button" className="toast-action" onClick={action.onClick}>
					{action.label}
				</button>
			)}
		</div>
	);
}
