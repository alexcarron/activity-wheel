import { useEffect } from 'react';
import './Toast.css';

const TOAST_DURATION_MILLISECONDS = 4000;

export function Toast({ message, onDismiss }: { message: string; onDismiss(): void }) {
	useEffect(() => {
		const timer = setTimeout(onDismiss, TOAST_DURATION_MILLISECONDS);
		return () => clearTimeout(timer);
	}, [onDismiss]);

	return (
		<div className="toast" role="status">
			<span className="toast-message">{message}</span>
		</div>
	);
}
