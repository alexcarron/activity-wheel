/** Full-screen gate shown while a shared wheel named by ?sharedWheelId= hasn't been unlocked yet. */

import { useState } from 'react';
import './SharedWheelPasswordGate.css';

interface SharedWheelPasswordGateProps {
	wheelName: string;
	unlocking: boolean;
	errorMessage: string | null;
	onUnlock(password: string): Promise<boolean>;
}

export function SharedWheelPasswordGate({
	wheelName,
	unlocking,
	errorMessage,
	onUnlock,
}: SharedWheelPasswordGateProps) {
	const [password, setPassword] = useState('');

	const handleSubmit = async (event: React.FormEvent): Promise<void> => {
		event.preventDefault();
		if (!password || unlocking) return;
		const wasUnlocked = await onUnlock(password);
		if (!wasUnlocked) setPassword('');
	};

	return (
		<div className="shared-wheel-gate">
			<form className="shared-wheel-gate-card" onSubmit={(event) => void handleSubmit(event)}>
				<h1 className="shared-wheel-gate-title">{wheelName}</h1>
				<p className="shared-wheel-gate-subtitle">Enter the password to view and edit this shared wheel.</p>
				<input
					type="password"
					className="shared-wheel-gate-input"
					value={password}
					onChange={(event) => setPassword(event.target.value)}
					placeholder="Password"
					autoFocus
					disabled={unlocking}
				/>
				{errorMessage && (
					<p className="shared-wheel-gate-error" role="alert">
						{errorMessage}
					</p>
				)}
				<button
					type="submit"
					className="btn btn-primary"
					disabled={unlocking || !password}
				>
					{unlocking ? 'Checking…' : 'Unlock'}
				</button>
			</form>
		</div>
	);
}
