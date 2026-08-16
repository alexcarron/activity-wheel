/** Small auto-dismissing banner, e.g. for "Wheel updated by another user." notices. */

import { useEffect } from 'react';
import './Toast.css';

interface ToastProps {
	message: string;
	onDismiss(): void;
	/** Milliseconds before auto-dismiss. */
	durationMs?: number;
}

export function Toast({ message, onDismiss, durationMs = 4000 }: ToastProps) {
	useEffect(() => {
		const timer = setTimeout(onDismiss, durationMs);
		return () => clearTimeout(timer);
	}, [onDismiss, durationMs]);

	return (
		<div className="shared-wheel-toast" role="status">
			{message}
		</div>
	);
}
